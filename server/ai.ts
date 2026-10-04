import Anthropic from '@anthropic-ai/sdk'
import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  DEFAULT_AWS_REGION,
  DEFAULT_BEDROCK_MODEL_ID,
  MAX_BODY,
  isBedrockConfigured,
  makeBedrockClient,
  runWithAnthropic,
  runWithBedrock,
  validateAsk,
  type AskBody,
  type ChatMessage,
} from './askHandler.ts'

// POST /api/ask {system?, messages:[{role,content}]} -> {text}
// 503 when no key (the client falls back to its offline brain); any other non-200 also falls back.
// Dev/preview only: production serves this route from api/ask.ts (Vercel serverless function).

let viteEnv: Record<string, string> | undefined
function env(name: string): string | undefined {
  return process.env[name] || ((viteEnv ??= loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''))[name] || undefined)
}

let client: Anthropic | undefined
function getClient() {
  // Vite does not copy .env into process.env, so read ANTHROPIC_API_KEY from .env / .env.local too.
  const apiKey = env('ANTHROPIC_API_KEY')
  if (!apiKey) return undefined
  // Fail fast so the UI can switch to offline answers instead of hanging.
  return (client ??= new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 }))
}

let bedrockClient: BedrockRuntimeClient | undefined
let bedrockRegion = ''
function getBedrock() {
  if (!isBedrockConfigured(env)) return undefined
  const region = env('AWS_REGION') || DEFAULT_AWS_REGION
  if (!bedrockClient || bedrockRegion !== region) {
    bedrockClient = makeBedrockClient(env, region)
    bedrockRegion = region
  }
  return bedrockClient
}

export async function aiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url !== '/api/ask' || req.method !== 'POST') return next()
  const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
  const bedrock = getBedrock()
  const ai = bedrock ? undefined : getClient()
  if (!bedrock && !ai) return send(503, { error: 'no_key' })

  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY) return send(413, { error: 'too_large' })
  }
  let body: AskBody
  try { body = JSON.parse(raw) } catch { return send(400, { error: 'invalid_json' }) }
  if (!body || typeof body !== 'object') return send(400, { error: 'invalid_body' })
  const bad = validateAsk(body)
  if (bad) return send(400, { error: bad })

  if (bedrock) {
    const r = await runWithBedrock(bedrock, env('BEDROCK_MODEL_ID') || DEFAULT_BEDROCK_MODEL_ID, body.system as string | undefined, body.messages as ChatMessage[])
    send(r.status, r.body)
    return
  }

  const r = await runWithAnthropic(ai!, body.system as string | undefined, body.messages as ChatMessage[])
  send(r.status, r.body)
}
