import { useUI } from './ui'

/** Single AI entry point. Returns null in demo mode or on any failure — callers MUST then use their deterministic fallback. */
export async function ask(system: string, messages: { role: 'user' | 'assistant'; content: string }[], timeoutMs = 15000): Promise<string | null> {
  if (useUI.getState().demoMode) return null
  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system, messages }), signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return ((await res.json()) as { text?: string }).text || null
  } catch {
    return null
  }
}
