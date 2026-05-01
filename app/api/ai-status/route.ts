import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico rápido: confirma si el server está viendo la API key de Anthropic.
 * Nunca devuelve el valor completo — solo longitud y prefijo.
 */
export async function GET() {
  // Mismo orden que lib/ai/client.ts::readAnthropicKey().
  const finanzas = process.env.FINANZAS_AI_KEY ?? '';
  const anthropic = process.env.ANTHROPIC_API_KEY ?? '';
  const claude = process.env.CLAUDE_API_KEY ?? '';
  const resolved = [finanzas, anthropic, claude].find((v) => v.trim().length > 0) ?? '';
  return NextResponse.json({
    hasKey: Boolean(resolved),
    length: resolved.length,
    prefix: resolved.slice(0, 10),
    suffix: resolved.slice(-6),
    source: finanzas ? 'FINANZAS_AI_KEY' : anthropic ? 'ANTHROPIC_API_KEY' : claude ? 'CLAUDE_API_KEY' : 'none',
    cmcHasKey: Boolean(process.env.COINMARKETCAP_API_KEY),
  });
}
