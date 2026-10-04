# TSICL Audit Assistant — Demo MVP Plan

**Pitch:** "AI drafts. Auditor decides." An AI-assisted internal-audit workspace for Tripura Small Industries
Corporation Ltd. It collects documents, chases departments for missing records automatically, extracts data,
runs audit checks, keeps an evidence trail for every finding and drafts the quarterly Board report.
The appointed CA firm still makes every judgement and signs off.

**Audience of the demo:** the Managing Director and senior officers. They are non-technical, so they must
understand every screen in 5 seconds. **Bar: Apple / Linear-level polish.**

## Stack (installed — workers must NOT run npm install)
- Vite + React 19 + TS + Tailwind v4, shadcn/ui (radix-nova), `motion` (import from `motion/react`), lucide-react,
  recharts (via shadcn `chart`), zustand, cmdk, sonner, next-themes, driver.js (tour)
- Magic UI: number-ticker (en-IN), border-beam, animated-list, bento-grid, shimmer-button, blur-fade,
  animated-circular-progress-bar, text-animate
- PaceUI: dot-loader (`@/components/ui/dot-loader`) as the "AI is working" indicator
- prompt-kit: chat-container, prompt-input, markdown (AI assistant)
- sensory-ui (semantic Web-Audio sounds). Its engine is vendored by hand because its CLI install is broken. Use it via `play(role)` from `@/lib/sound`
- Fonts: Geist (Latin), Noto Sans Bengali / Devanagari (language toggle EN / বাংলা / हिन्दी)
- AI: `POST /api/ask {system, messages}` → `{text}` (Vite middleware → Claude `claude-sonnet-5-5`).
  Returns **503 when no ANTHROPIC_API_KEY**, so every AI feature MUST have a deterministic offline fallback and the demo never breaks.

### Library research verdicts
| Library | Verdict |
|---|---|
| sensory-ui | Used. Vendor its engine (MIT) from github.com/SatyamVyas04/sensory-ui |
| paceui.com | Motion components need an API key / paid plan. We use the free `dot-loader` only |
| vantaui.com | Paid, with a personal-use-only free tier. We copy only its tokens and motion timings |
| easyui.site | MIT. Optional: `npx shadcn add Surajmaurya1/easyui/<name>` (framer-motion based). Use the patterns, don't install |
| cuedesign.space | Paid prompt library. We copy its patterns: one primary action per screen, illustrated empty states, layoutId tab indicator |
| great-ui.com | Marketing effects, no dashboard parts. Skipped |
| designbookmark / dev.cards | Directory / Commons-Clause license. We copy card patterns: neutral tray, one dominant number, whole-row hit targets |

## Design direction (every worker follows this)
- **Calm, neutral, precise** (Linear / Apple). Neutral surfaces. Colour **only** encodes meaning (severity, AI = violet).
  Depth from 1px borders + very soft shadow on hover; no heavy drop shadows, no gradients on content.
- Type: Geist, 14–15px UI, 28px page titles, `tracking-tight` on headings, `tabular-nums` for money/counts.
  Weights 400/500/600 only.
- Spacing: 4/8/12/16/24/32. Card radius `rounded-2xl`, controls `rounded-lg`. Max width ~1280px.
- Motion: 150–250ms ease-out, `motion/react` springs for layout. Animate only transform/opacity.
  Respect `prefers-reduced-motion` (`useReducedMotion`). Never loop motion on idle content. Stagger lists on first paint with BlurFade.
- **Plain language everywhere.** "Money owed to us", not "Trade receivables". Technical term is secondary, in muted text.
- Money: `formatINR` / `formatINRShort` from `@/lib/utils` (₹8,42,000 / ₹4.2 Cr). Dates: `formatDate`.
- Every screen has **one obvious primary action**. Touch targets ≥ 40px. Text labels next to icons.
- Severity = colour + icon + word, via `<SeverityBadge>`. Confidence in words via `<Confidence>`.
- Every AI claim shows evidence chips (`<EvidenceChip>`) and a human decision. AI never auto-applies.
- Empty, loading and error states are designed, never blank (`<EmptyState>`, skeletons, dot-loader).
- Light + dark both look premium. Mobile ≥ 360px has no horizontal scroll.
- Shared kit `@/components/kit`: `PageHeader, KpiCard, SeverityBadge, EvidenceChip, Confidence, AiInsight, EmptyState`. **Use it.**
- Tokens: `bg-sev-critical|high|medium|low|ok`, `text-ai`, `bg-ai/10` etc. (see `src/index.css`).
- Tour anchors (`data-tour="..."`): `nav`, `search`, `ask-ai`, `attention`, `kpis`, `findings-list`, `evidence`, `decision`, `report-generate`, `requests-auto`.

## Data contract
`src/data/types.ts` (frozen, additive-only), `src/data/store.ts` (`useAudit` zustand, actions), `seed.ts` + `rules.ts` (pure).
Demo "today" = `TODAY` = 2026-10-04, Q2 FY 2026-27 (Jul–Sep 2026). Divisions are TSICL units across Tripura.

## Screens (routes)
| Route | Screen | What makes it impressive |
|---|---|---|
| `/` | **Today** | "Good morning, Sir. While you were away, AI…" narrative; 5-item attention inbox; 4 KPIs; live activity feed; audit progress ring |
| `/inbox` | **Document Inbox** | Simulated `audit@tsicl.ai` mailbox + drag-drop; live pipeline Received → Reading → Classified → Extracted → Checked; side-by-side doc preview with highlighted extracted fields |
| `/requests` | **Requests & Follow-ups** | AI-drafted request emails; stepper Sent → Reminder 1 → Reminder 2 → Escalated; "Fast-forward a week" demo button shows the automation |
| `/findings` | **Findings** | Evidence graph (PO → Invoice → Approval → Rule); Confirm / Reject (reason) / Investigate; keyboard J/K/C/R/I |
| `/procurement` | **Purchases** | Delegation-of-power limit bars, PO-splitting cluster visual, single-quote flags, vendor concentration |
| `/receivables` | **Money Owed** | Ageing buckets, overdue customers, unmatched receipts with AI-suggested matches |
| `/assets` | **Assets** | Register, verification progress, phone-style QR "scan & verify" mode |
| `/checks` | **Audit Checks** | 20 checks as plain-English toggles; "Run full audit" with animated progress |
| `/field` | **Field Visits** | Sampling calculator (methodology the tender asks for) and division visit planner |
| `/report` | **Quarterly Report** | Board-ready report, AI executive summary, print/PDF, auditor sign-off |
| global | **AI Assistant** | Slide-over chat, suggested questions, voice (en-IN/bn-IN/hi-IN), answers cite findings |
| global | **Shell** | Sidebar with live counts, ⌘K palette ("ask anything"), language and sound toggles, theme, guided tour |

## Execution: Opus orchestrates, Sonnet workers build (parallel)
| # | Worker | Owns (only these files) |
|---|---|---|
| W1 | Data + rules engine | `src/data/seed.ts`, `src/data/rules.ts`, `src/data/rules.check.ts` |
| W2 | Design system + shell | `src/index.css`, `src/components/shell/**`, `src/components/kit.tsx` (styling only), `src/lib/ui.ts` (additive) |
| W3 | Today | `src/pages/Home.tsx`, `src/features/home/**` |
| W4 | Inbox | `src/pages/Inbox.tsx`, `src/features/inbox/**` |
| W5 | Requests | `src/pages/Requests.tsx`, `src/features/requests/**` |
| W6 | Findings | `src/pages/Findings.tsx`, `src/features/findings/**` |
| W7 | Purchases | `src/pages/Procurement.tsx`, `src/features/procurement/**` |
| W8 | Money owed | `src/pages/Receivables.tsx`, `src/features/receivables/**` |
| W9 | Assets | `src/pages/Assets.tsx`, `src/features/assets/**` |
| W10 | Checks + Field | `src/pages/Checks.tsx`, `src/pages/Field.tsx`, `src/features/checks/**`, `src/features/field/**` |
| W11 | Report | `src/pages/Report.tsx`, `src/features/report/**` |
| W12 | AI assistant | `src/features/assistant/**`, `server/ai.ts` |
| W13 | Sound + i18n + tour | `src/lib/sound.tsx`, `src/lib/sensory/**`, `src/lib/i18n.ts`, `src/features/tour/**`, `play()` calls in `src/data/store.ts` |

Wave 2 (after merge): browser QA agent (screenshots at desktop and mobile, light and dark, console errors), React/TS reviewer, Opus final polish pass.

## Done when
`npm run build` is green, no console errors, every route renders realistic data, every AI feature works offline,
and the 90-second demo script runs: Today → Inbox (drop a file) → Findings (confirm one) → Requests (fast-forward) → Report (print).

## Revision 1 (after external review)
- **Hero screens for the demo:** Today, Inbox, Finding detail, Requests, Report. The other routes exist but aren't demoed.
- **Tender-mapped checks:** the 20 rules map 1:1 to the EOI scope across 9 areas, including Cash & Bank, Establishment, Statutory, Internal Controls and CAG. Each rule and finding carries a `scopeRef`.
- **Provenance:** every finding carries `basis` (document + field + value), `engine` and the rule. "Why did the AI flag this?" is answered in one click.
- **Human-in-the-loop:** escalation is *recommended* by AI and *approved* by the auditor (`approveEscalation`). Request emails are approved before sending.
- **Findings UX:** a simple executive card comes first. The evidence graph sits behind "View evidence chain".
- **Deterministic demo mode** is the default (`useUI.demoMode`). All AI goes through `ask()` in `src/lib/ai.ts`, which returns null in demo mode or on failure, so the seeded output is used. "Live AI" is opt-in from the ••• menu.
- **Sound** is off by default and lives only in components, never in the store. The tour is opt-in.
- **Reset demo** (`useAudit.resetDemo`) sits in the ••• menu. An always-visible "DEMO DATA · Q2 FY 2026-27" pill is shown. The mailbox is `demo-audit@tsicl-demo.in`.
- **Multi-year coverage:** FY 2024-25, 2025-26 and 2026-27, per the EOI.
- **Wording:** "AI-assisted audit workflow" everywhere. AI drafts, the auditor decides.

## 90-second demo script
1. **0–15s Today:** "Here's what changed since the last review." Point at the attention list.
2. **15–32s Inbox:** "Simulate incoming email". Show Received → Reading → Extracted → Checked, then the extracted fields.
3. **32–50s Finding:** open "Approval authority exceeded" (PO-2026-184). Point at the three evidence chips, click Confirm. *AI drafts. Auditor decides.*
4. **50–65s Requests:** Fast-forward. Show Sent → Reminder → Escalation recommended → Approve.
5. **65–90s Report:** Generate quarterly report and show the executive summary. Close: *"The auditor remains responsible for the audit. We automate the repetitive work around them."*
