import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

/**
 * Lee la API key desde varias variables de entorno posibles, en orden:
 *  1. FINANZAS_AI_KEY     — nombre propio del proyecto (recomendado)
 *  2. ANTHROPIC_API_KEY   — nombre estándar de Anthropic
 *  3. CLAUDE_API_KEY      — alias común
 *
 * Algunos shells/entornos (ej. Claude Code) setean `ANTHROPIC_API_KEY=""`
 * de forma automática, lo cual pisa lo que ponemos en `.env`. Por eso
 * aceptamos múltiples nombres y elegimos el primero que no esté vacío.
 */
function readAnthropicKey(): string {
  const candidates = [
    process.env.FINANZAS_AI_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.CLAUDE_API_KEY,
  ];
  for (const v of candidates) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return '';
}

/**
 * Cliente Anthropic singleton. Lanza si falta la API key —
 * llamá primero a `isAssistantEnabled()` para saber si está configurada.
 */
export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = readAnthropicKey();
  if (!apiKey) {
    throw new Error(
      'El asistente financiero no está habilitado. Configurá FINANZAS_AI_KEY (o ANTHROPIC_API_KEY) en el archivo .env.'
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export function isAssistantEnabled(): boolean {
  return readAnthropicKey().length > 0;
}

/**
 * Modelo por defecto. Usamos Sonnet 4.5 porque balancea calidad y costo
 * para conversaciones financieras que a veces incluyen imágenes.
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-5';
