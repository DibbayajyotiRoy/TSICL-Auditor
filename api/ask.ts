import Anthropic from '@anthropic-ai/sdk'
import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
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
} from '../server/askHandler.ts'

// Vercel Node serverless function: POST /api/ask {system?, messages:[{role,content}]} -> {text}.
// Same contract as the Vite dev middleware in server/ai.ts; shared core lives in server/askHandler.ts.
// 503 when no key (the client falls back to its offline brain); any other non-200 also falls back.

type Req = { method?: string; body?: unknown }
type Res = { status: (code: number) => Res; json: (body: unknown) => void }

const get = (name: string): string | undefined => process.env[name] || undefined

let client: Anthropic | undefined
function getClient() {
  const apiKey = get('ANTHROPIC_API_KEY')
  if (!apiKey) return undefined
  // Fail fast so the UI can switch to offline answers instead of hanging.
  return (client ??= new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 }))
}

let bedrockClient: BedrockRuntimeClient | undefined
let bedrockRegion = ''
function getBedrock() {
  if (!isBedrockConfigured(get)) return undefined
  const region = get('AWS_REGION') || DEFAULT_AWS_REGION
  if (!bedrockClient || bedrockRegion !== region) {
    bedrockClient = makeBedrockClient(get, region)
    bedrockRegion = region
  }
  return bedrockClient
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  const bedrock = getBedrock()
  const ai = bedrock ? undefined : getClient()
  if (!bedrock && !ai) return res.status(503).json({ error: 'no_key' })

  // Vercel pre-parses JSON bodies; accept a raw string too.
  let body: AskBody
  if (typeof req.body === 'string') {
    if (req.body.length > MAX_BODY) return res.status(413).json({ error: 'too_large' })
    try { body = JSON.parse(req.body) } catch { return res.status(400).json({ error: 'invalid_json' }) }
  } else {
    body = (req.body ?? {}) as AskBody
    if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'too_large' })
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid_body' })
  const bad = validateAsk(body)
  if (bad) return res.status(400).json({ error: bad })

  if (bedrock) {
    const r = await runWithBedrock(bedrock, get('BEDROCK_MODEL_ID') || DEFAULT_BEDROCK_MODEL_ID, body.system as string | undefined, body.messages as ChatMessage[])
    return res.status(r.status).json(r.body)
  }

  const r = await runWithAnthropic(ai!, body.system as string | undefined, body.messages as ChatMessage[])
  return res.status(r.status).json(r.body)
}
