import Anthropic from '@anthropic-ai/sdk'
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'

// Shared provider + validation core for POST /api/ask {system?, messages:[{role,content}]} -> {text}.
// Imported by BOTH server/ai.ts (Vite dev middleware) and api/ask.ts (Vercel serverless function).
// Pure: no vite / node:http imports here, so it runs in either runtime.
// 503 when no key (the client falls back to its offline brain); any other non-200 also falls back.
export const MAX_BODY = 100_000 // bytes
export const MAX_MESSAGES = 20
export const MAX_CHARS = 8_000 // all message text together
export const MAX_SYSTEM = 20_000

export const DEFAULT_BEDROCK_MODEL_ID = 'amazon.nova-micro-v1:0'
export const DEFAULT_AWS_REGION = 'us-east-1'
export const ANTHROPIC_MODEL = 'claude-sonnet-5-5'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type AskBody = { system?: unknown; messages?: unknown }
export type AskResult = { status: number; body: { text: string } | { error: string } }

/** Returns an error string, or null when the payload is acceptable. */
export function validateAsk(body: AskBody): string | null {
  const { system, messages } = body
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return `messages must be an array of 1-${MAX_MESSAGES} items`
  let chars = 0
  for (const m of messages) {
    if ((m?.role !== 'user' && m?.role !== 'assistant') || typeof m.content !== 'string') return 'each message needs role user|assistant and string content'
    chars += m.content.length
  }
  if (chars > MAX_CHARS) return `messages exceed ${MAX_CHARS} characters`
  if (messages[0].role !== 'user') return 'first message must be from the user'
  if (system !== undefined && (typeof system !== 'string' || system.length > MAX_SYSTEM)) return `system must be a string under ${MAX_SYSTEM} characters`
  return null
}

/** Client factory: explicit static creds from env win when present, otherwise the SDK default chain (shared config, SSO, instance role). */
export function makeBedrockClient(get: (name: string) => string | undefined, region: string): BedrockRuntimeClient {
  const accessKeyId = get('AWS_ACCESS_KEY_ID')
  const secretAccessKey = get('AWS_SECRET_ACCESS_KEY')
  const sessionToken = get('AWS_SESSION_TOKEN')
  return accessKeyId && secretAccessKey
    ? new BedrockRuntimeClient({ region, credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } })
    : new BedrockRuntimeClient({ region })
}

/** Scrub secret-looking material out of server-side log lines (keys, tokens, signatures). */
export function redact(s: string): string {
  return s
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA…REDACTED')
    .replace(/(api[_-]?key|secret|token|signature|session[_-]?token)\s*[:=]\s*['"]?[^\s'"};,]+/gi, '$1=<redacted>')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/g, 'Bearer <redacted>')
    .replace(/X-Amz-Signature=[0-9a-f]+/gi, 'X-Amz-Signature=<redacted>')
}

export function isBedrockConfigured(get: (name: string) => string | undefined): boolean {
  return Boolean(get('BEDROCK_MODEL_ID') || get('AWS_ACCESS_KEY_ID') || get('AWS_PROFILE'))
}

export async function runWithBedrock(
  bedrock: BedrockRuntimeClient,
  modelId: string,
  system: string | undefined,
  messages: ChatMessage[],
): Promise<AskResult> {
  try {
    const out = await bedrock.send(new ConverseCommand({
      modelId,
      system: system ? [{ text: system }] : undefined,
      messages: messages.map((m) => ({
        role: m.role,
        content: [{ text: m.content }],
      })),
      inferenceConfig: { maxTokens: 2048 },
    }))
    const stop: string | undefined = out.stopReason
    if (stop === 'guardrail_intervene' || stop === 'guardrail_intervened' || stop === 'refusal' || stop === 'content_filtered') return { status: 502, body: { error: 'refusal' } }
    const text = (out.output?.message?.content ?? []).map((b) => b.text ?? '').join('').trim()
    if (!text) return { status: 502, body: { error: 'empty' } }
    return { status: 200, body: { text } }
  } catch (e) {
    console.error('[ai] /api/ask failed:', redact(e instanceof Error ? e.message : String(e)))
    return { status: 500, body: { error: 'ai_failed' } }
  }
}

export async function runWithAnthropic(
  ai: Anthropic,
  system: string | undefined,
  messages: ChatMessage[],
): Promise<AskResult> {
  try {
    const msg = await ai.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      // Short chat answers: low effort keeps latency down. Sampling params and budget_tokens are rejected on this model, so none are sent.
      output_config: { effort: 'low' },
      system,
      messages: messages as Anthropic.MessageParam[],
    })
    if (msg.stop_reason === 'refusal') return { status: 502, body: { error: 'refusal' } }
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    if (!text) return { status: 502, body: { error: 'empty' } }
    return { status: 200, body: { text } }
  } catch (e) {
    console.error('[ai] /api/ask failed:', redact(e instanceof Error ? e.message : String(e)))
    return { status: e instanceof Anthropic.APIError && e.status ? e.status : 500, body: { error: 'ai_failed' } }
  }
}
