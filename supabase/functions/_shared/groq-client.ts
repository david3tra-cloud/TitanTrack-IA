/**
 * Cliente de Groq para Edge Functions.
 * La clave GROQ_API_KEY vive únicamente como secreto de Edge Function
 * (Deno.env.get). Nunca se expone al frontend ni se registra en logs.
 */

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_TIMEOUT_MS = 30000;
const MAX_OUTPUT_TOKENS = 2000;

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChoice {
  message?: { content: string };
  text?: string;
}

export interface GroqResponse {
  choices?: GroqChoice[];
}

export interface GroqErrorInfo {
  status: number;
  message: string;
}

export class GroqClientError extends Error {
  constructor(public info: GroqErrorInfo) {
    super(info.message);
    this.name = 'GroqClientError';
  }
}

export async function callGroq(
  messages: GroqMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new GroqClientError({
      status: 500,
      message: 'Configuración de IA incompleta en el servidor',
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_completion_tokens: options.maxTokens ?? MAX_OUTPUT_TOKENS,
        reasoning_effort: 'low',
        include_reasoning: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GroqClientError({
        status: 502,
        message: `Error del proveedor de IA (${response.status})`,
      });
    }

    const data = (await response.json()) as GroqResponse;

    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      null;

    if (content === null || typeof content !== 'string') {
      throw new GroqClientError({
        status: 502,
        message: 'Respuesta inesperada del proveedor de IA',
      });
    }

    return content;
  } catch (err) {
    if (err instanceof GroqClientError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GroqClientError({
        status: 504,
        message: 'Tiempo de espera agotado al contactar con el proveedor de IA',
      });
    }
    throw new GroqClientError({
      status: 502,
      message: 'Error inesperado al contactar con el proveedor de IA',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}