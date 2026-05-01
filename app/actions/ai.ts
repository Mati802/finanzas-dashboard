'use server';

import { revalidatePath } from 'next/cache';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropic, isAssistantEnabled, DEFAULT_MODEL } from '@/lib/ai/client';
import { buildFinancialContext } from '@/lib/ai/context';
import { db } from '@/lib/db';
import { executeTool, getToolDefinitions, type ToolActionSummary } from '@/lib/ai/tools';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Respuesta devuelta al cliente tras un turno de chat. */
export interface AssistantTurnResult {
  reply: string;
  toolActions: ToolActionSummary[];
  /** Id del mensaje del asistente recién guardado (por si la UI quiere referenciarlo). */
  messageId?: number;
  /** Título posiblemente renombrado (cuando es la primer respuesta del chat). */
  conversationTitle?: string;
  error?: string;
}

const ASSISTANT_SYSTEM_PROMPT = `Sos un asistente financiero personal experto que ayuda a un usuario argentino a manejar sus finanzas. Hablás SIEMPRE en español rioplatense (vos, usá, "tenés"), con tono cálido, claro y directo — como un amigo que sabe de finanzas, no un robot.

Tus especialidades:
- Presupuestos personales, ahorro e inversión
- Mercado argentino: dólar (oficial/blue/MEP/CCL/USDT), plazos fijos UVA, CEDEARs, FCIs, bonos
- Mercado cripto (BTC, ETH, stablecoins, staking) y mercado de acciones global
- Gastos fijos vs variables, regla 50/30/20, fondo de emergencia
- Inflación, devaluación, estrategias anti-inflación
- Interpretar y criticar hábitos de gasto
- Detectar transacciones en capturas de extractos / apps bancarias (Mercado Pago, Ualá, Brubank, etc.)

TENÉS ACCESO A HERRAMIENTAS para leer y modificar los datos del usuario en su app:
- list_categories / create_category: ver o crear categorías de transacciones
- create_transaction: registrar un gasto o ingreso (indicá categoryName o categoryId)
- list_assets / create_asset: ver o agregar activos (efectivo, cripto, acciones, propiedades)
- create_liability: registrar una deuda
- get_financial_summary: ver el patrimonio actual

Políticas de uso de herramientas:
1. Si el usuario te pasa una imagen de una transacción/extracto/ticket, **extraé automáticamente las transacciones y registralas** con create_transaction. Para cada una:
   - Decidí una categoría razonable (si no existe en list_categories, creala con create_category primero).
   - Usá la fecha visible en la imagen; si no se ve, usá la fecha de hoy.
   - Si la moneda no queda clara, asumí ARS (es un usuario argentino) salvo que el símbolo sea US$/USD.
   - Después de registrarlas, avisá al usuario qué cargaste en 2-3 líneas.
2. Si el usuario te describe en texto un gasto o ingreso concreto ("gasté 50 luca en supermercado hoy"), registralo directamente con create_transaction. No preguntes "¿querés que lo cargue?" — cargalo y confirmá después.
3. Para análisis sin acción (ej. "¿cómo vengo con los gastos?"), NO uses herramientas de escritura. Usá get_financial_summary o list_categories si necesitás números actuales.
4. Si hay ambigüedad real (ej. no se distingue si es gasto propio o de otra persona), preguntá UNA vez antes de cargar.
5. Nunca inventes montos o fechas — si no los ves con claridad, pedí que te los aclare.

Reglas generales:
- Respondé de forma concisa pero útil (3–8 líneas salvo que pidan más detalle).
- No des consejo de inversión definitivo — sugerí opciones y explicá riesgos.
- Usá números reales del contexto cuando estén disponibles.
`;

/**
 * Procesa un turno completo del chat:
 *  1. Persiste el mensaje del usuario (y opcional imagen).
 *  2. Llama a Claude con el historial completo + tools habilitadas.
 *  3. Corre el loop de tool_use hasta stop_reason='end_turn'.
 *  4. Persiste el mensaje del asistente con el resumen de acciones.
 *  5. Si era el primer turno, renombra la conversación con un título auto-generado.
 */
export async function sendChatMessage(params: {
  conversationId: number;
  userText: string;
  image?: {
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    /** base64 sin el prefijo data:. */
    data: string;
  };
}): Promise<AssistantTurnResult> {
  if (!isAssistantEnabled()) {
    return {
      reply: '',
      toolActions: [],
      error:
        'El asistente no está habilitado. Configurá FINANZAS_AI_KEY en .env.local y reiniciá el servidor.',
    };
  }

  const { conversationId, userText, image } = params;
  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return { reply: '', toolActions: [], error: 'Conversación no encontrada.' };
  }

  // 1) Persistir mensaje del usuario.
  const textForDb = userText.trim() || (image ? '(imagen adjunta)' : '');
  await db.message.create({
    data: {
      conversationId,
      role: 'user',
      content: textForDb,
      imageData: image?.data ?? null,
      imageMediaType: image?.mediaType ?? null,
    },
  });

  // 2) Construir el historial para Claude desde la DB (single source of truth).
  const history = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  const apiMessages: Anthropic.MessageParam[] = history.map((m) => {
    const blocks: Anthropic.ContentBlockParam[] = [];
    if (m.imageData && m.imageMediaType) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: m.imageMediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
          data: m.imageData,
        },
      });
    }
    if (m.content) {
      blocks.push({ type: 'text', text: m.content });
    }
    if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
    return { role: m.role as ChatRole, content: blocks };
  });

  const context = await buildFinancialContext().catch(() => '');
  const client = getAnthropic();
  const tools = getToolDefinitions();

  const toolActions: ToolActionSummary[] = [];
  let finalText = '';
  let error: string | undefined;

  try {
    // 3) Loop de tool_use: en cada iteración mandamos el historial acumulado
    // con los tool_result intercalados hasta que Claude devuelva stop_reason='end_turn'.
    // Guardrail: max 10 iteraciones para evitar loops infinitos.
    for (let iter = 0; iter < 10; iter++) {
      const res = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        system: `${ASSISTANT_SYSTEM_PROMPT}\n\n=== CONTEXTO ACTUAL ===\n${context}`,
        tools,
        messages: apiMessages,
      });

      // Guardamos el bloque completo del asistente en el historial para el próximo turno.
      apiMessages.push({ role: 'assistant', content: res.content });

      const textBlocks = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (textBlocks) finalText = textBlocks;

      if (res.stop_reason !== 'tool_use') break;

      const toolUses = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );
      if (toolUses.length === 0) break;

      // Ejecutamos todas las tools solicitadas en el mismo turno (en paralelo)
      // y devolvemos los resultados agrupados en un user message.
      const results = await Promise.all(
        toolUses.map(async (tu) => {
          const r = await executeTool(tu.name, (tu.input ?? {}) as Record<string, unknown>);
          if (r.action) toolActions.push(r.action);
          const payload = r.ok
            ? JSON.stringify(r.data ?? { ok: true })
            : JSON.stringify({ error: r.error ?? 'error desconocido' });
          const block: Anthropic.ToolResultBlockParam = {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: payload,
            is_error: !r.ok,
          };
          return block;
        })
      );

      apiMessages.push({ role: 'user', content: results });
    }
  } catch (err) {
    console.error('[ai] sendChatMessage failed', err);
    error = err instanceof Error ? err.message : 'Error desconocido al consultar el asistente.';
  }

  if (!finalText && !error) {
    error = 'El modelo no devolvió texto.';
  }

  // 4) Persistir el mensaje del asistente.
  let messageId: number | undefined;
  if (finalText || toolActions.length) {
    const saved = await db.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: finalText || '(acciones ejecutadas)',
        toolActions: toolActions.length ? JSON.stringify(toolActions) : null,
      },
    });
    messageId = saved.id;
  }

  // 5) Renombrar la conversación si era el primer intercambio.
  let newTitle: string | undefined;
  const wasFirstTurn = history.length <= 1; // solo el user message actual
  if (wasFirstTurn && finalText) {
    newTitle = buildTitleFromFirstMessage(userText) || 'Conversación';
    await db.conversation.update({ where: { id: conversationId }, data: { title: newTitle } });
  } else {
    // Actualiza el updatedAt para que suba en el sidebar.
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }

  // 6) Si hubo tool actions que cambiaron datos, refrescar páginas relevantes.
  if (toolActions.length) {
    revalidatePath('/');
    revalidatePath('/transacciones');
    revalidatePath('/ingresos');
    revalidatePath('/gastos');
    revalidatePath('/inversiones');
    revalidatePath('/patrimonio');
    revalidatePath('/reportes');
    revalidatePath('/ajustes');
  }

  return {
    reply: finalText,
    toolActions,
    messageId,
    conversationTitle: newTitle,
    error,
  };
}

/**
 * Elige un título corto a partir del primer mensaje (las primeras palabras
 * significativas). Si está vacío devuelve null para dejar el default.
 */
function buildTitleFromFirstMessage(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const words = clean.split(' ').slice(0, 8).join(' ');
  return words.length > 60 ? words.slice(0, 57) + '…' : words;
}

/** Expone si el asistente está habilitado (server-safe wrapper). */
export async function getAssistantEnabled(): Promise<boolean> {
  return isAssistantEnabled();
}
