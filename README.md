# TSICL Auditor — AI-assisted audit dashboard (template)

> "AI drafts. Auditor decides." An internal-audit workspace demo for Tripura Small Industries
> Corporation Ltd. — built as a **reusable template for any review-workflow dashboard**
> (audits, inspections, compliance reviews, approval pipelines).

It collects documents, chases departments for missing records, runs deterministic audit checks,
keeps an evidence trail for every finding, drafts the quarterly Board report — and answers
questions in English, বাংলা, or हिन्दी, online (AWS Bedrock) or fully offline.

## Screens

| Route | Screen |
|---|---|
| `/` | **Today** — attention inbox, KPIs, risk map, live activity |
| `/inbox` | **Document Inbox** — simulated mailbox, drag-drop, AI reading pipeline, side-by-side extraction |
| `/requests` | **Requests & Follow-ups** — drafted emails, reminder stepper, fast-forward-a-week demo |
| `/findings` | **Findings** — evidence graph, Confirm / Reject / Investigate, keyboard shortcuts |
| `/procurement` | **Purchases** — delegation limits, split-order detection, vendor concentration |
| `/receivables` | **Money Owed** — ageing buckets, overdue tracking, AI receipt matching |
| `/assets` | **Assets** — register, verification progress, scan-&-verify mode |
| `/checks` | **Audit Checks** — 20 plain-English checks mapped to the audit scope |
| `/field` | **Field Visits** — sampling calculator, visit planner |
| `/report` | **Quarterly Report** — Board-ready report, executive summary, print/PDF, sign-off |

Plus: slide-over **AI assistant** (voice input included), `⌘K` command palette, guided tour,
dark mode, and full EN / বাংলা / हिन्दी translation (~1000 UI strings).

## Tech stack

React 19 + Vite + TypeScript + Tailwind v4, shadcn/ui, zustand, recharts, Motion,
`thinking-orbs` / `voice-glow` / `bot-avatars` for the AI surfaces.
AI: `POST /api/ask` → AWS Bedrock (default `amazon.nova-micro-v1:0`, the cheapest
Bedrock text model) with Anthropic fallback — and a deterministic offline brain,
so the demo never breaks with no key. Page-view analytics via Vercel Analytics
(`<Analytics />` in `src/App.tsx`; data appears in the Vercel dashboard after deploy).

## Quickstart

```bash
npm install
npm run dev        # http://localhost:5173
```

AI features (optional — everything works offline without them):

```bash
cp .env.example .env   # if present; otherwise create .env with:
```

| Variable | Purpose | Default |
|---|---|---|
| `AWS_REGION` | Bedrock region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Bedrock credentials (or use the AWS CLI profile chain) | — |
| `AWS_SESSION_TOKEN` | Only for temporary credentials | — |
| `BEDROCK_MODEL_ID` | Override the model | `amazon.nova-micro-v1:0` |
| `ANTHROPIC_API_KEY` | Fallback provider (Bedrock takes precedence) | — |

`.env` is gitignored. Switch **Demo mode ↔ Live AI** from the ••• menu in the top bar.

## The 90-second demo

Today → Inbox (simulate an email) → Findings (confirm `F-R01-PO-2026-184`) →
Requests (fast-forward a week, approve the escalation) → Report (generate, print).
*"The auditor remains responsible for the audit. We automate the repetitive work around them."*

## Reusing this as a template

The domain is isolated in a few files — swap them, keep everything else:

| Replace | File | What it is |
|---|---|---|
| Demo data | `src/data/seed.ts` | Divisions, documents, orders, dues, assets, requests |
| Checks | `src/data/rules.ts` | 20 deterministic rules → findings with evidence |
| Answers | `src/features/assistant/offline.ts` | Offline Q&A brain (keyword intents + chit-chat) |
| Words | `src/lib/i18n.ts` | English-keyed dictionary with bn/hi rows |
| Brand | `public/`, `index.html`, `Sidebar.tsx` | Logo, favicon, title |

`src/data/types.ts` is the frozen contract; `src/data/store.ts` (zustand) holds all
state and actions. Every AI feature goes through `ask()` in `src/lib/ai.ts` and
must degrade to a seeded answer — that rule is what makes the template demo-safe.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with the `/api/ask` middleware |
| `npm run build` | Typecheck + production build |
| `npm run lint` | oxlint |
| `npm run preview` | Preview the production build |

## Deploying on Vercel

1. Push to GitHub, import in Vercel (framework Vite is configured via `vercel.json`).
2. Set env vars in Vercel → Project → Settings → Environment Variables (see table above).
   Without any key, `/api/ask` returns 503 and the app uses its offline answers.
3. Deploy — `/api/ask` runs as a serverless function (`api/ask.ts`), SPA routes fall back to `index.html`.

## Security notes

- Secrets live only in `.env` / hosting env vars — never in responses. `/api/ask`
  returns `{text}` or a static `{error}` code; server logs are scrubbed of key-like material.
- `GET /.env` is blocked; the client bundle contains no credentials (verified by build-time grep).
