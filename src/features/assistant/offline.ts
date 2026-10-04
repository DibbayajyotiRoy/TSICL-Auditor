// OFFLINE BRAIN: a deterministic keyword matcher that composes answers from the live store.
// Used whenever /api/ask is unavailable (no API key, network error, refusal), so the demo never breaks.
// Every number and ID in an answer comes from the data; nothing is invented.
import type { Lang } from '@/lib/ui'
import { formatDate, formatINR, formatINRShort } from '@/lib/utils'
import { seed } from '@/data/seed'
import { runRules } from '@/data/rules'
import type { Finding, PurchaseOrder } from '@/data/types'
import { SEV_WORD, computeFacts, findFinding, findPO, knownIds, linkIds, type Data, type Facts } from './facts'

type Tr = (en: string, bn?: string, hi?: string) => string
type Intent = 'draft' | 'risk' | 'money' | 'late' | 'board' | 'asset' | 'buy' | 'help'

// Order = tie-break order. Includes Bengali and Hindi words so voice input in those languages routes correctly.
const WORDS: Record<Exclude<Intent, 'help'>, string[]> = {
  draft: ['remind', 'draft', 'email', 'mail', 'letter', 'write', 'follow up', 'follow-up', 'nudge', 'খসড়া', 'মনে করি', 'ইমেইল', 'চিঠি', 'ड्राफ्ट', 'याद दिला', 'पत्र', 'ईमेल'],
  risk: ['risk', 'biggest', 'worst', 'serious', 'urgent', 'critical', 'concern', 'danger', 'priorit', 'red flag', 'finding', 'ঝুঁকি', 'বিপদ', 'जोखिम', 'खतरा'],
  money: ['money', 'owed', 'owe', 'receivable', 'outstanding', 'customer', 'stuck', 'recover', 'collect', 'dues', 'ageing', 'aging', 'debtor', 'cash', 'টাকা', 'বকেয়া', 'পাওনা', 'গ্রাহক', 'पैसा', 'पैसे', 'बकाया', 'रकम', 'ग्राहक'],
  late: ['late', 'department', 'division', 'unit', 'request', 'document', 'pending', 'deadline', 'delay', 'overdue', 'chase', 'records', 'দেরি', 'বিভাগ', 'নথি', 'देरी', 'विभाग', 'दस्तावेज'],
  board: ['board', 'summary', 'summar', 'brief', 'tell the', 'present', 'meeting', 'executive', 'overall', 'status', 'update', 'বোর্ড', 'সারসংক্ষেপ', 'बोर्ड', 'सारांश'],
  asset: ['asset', 'equipment', 'verif', 'physical', 'qr', 'register', 'vehicle', 'machine', 'computer', 'laptop', 'furniture', 'সম্পদ', 'যাচাই', 'संपत्ति', 'परिसंपत्ति', 'सत्यापन'],
  buy: ['purchase', 'vendor', 'supplier', 'procure', 'quotation', 'quote', 'delegat', 'split', 'tender', 'work order', 'buying', 'ক্রয়', 'বিক্রেতা', 'खरीद', 'विक्रेता'],
}

export function intent(q: string): Intent {
  const s = q.toLowerCase()
  let best: Intent = 'help'
  let top = 0
  for (const [name, words] of Object.entries(WORDS) as [Exclude<Intent, 'help'>, string[]][]) {
    const score = words.filter((w) => s.includes(w)).length
    if (score > top) { top = score; best = name }
  }
  return best
}

// ---------------------------------------------------------------- chit-chat
// Friendly talk that needs no audit data (greetings, thanks, weather, "who are you").
// The live model answers these freely; offline we use short canned trilingual lines.
// Only used when the question is NOT about audit data: any finding/PO id or audit
// intent wins over chit-chat, so "hello, what are the risks?" still goes to risks().
export type ChatKind = 'greet' | 'thanks' | 'bye' | 'who' | 'weather' | 'able'
const CHAT: [ChatKind, RegExp][] = [
  ['thanks', /\b(thanks|thank you|thx|dhonnobad|ধন্যবাদ|shukriya|शुक्रिया)\b/i],
  ['bye', /\b(bye|goodbye|good night|see you|alvida|বিদায়|अलविदा)\b/i],
  ['who', /(who are you|your name|what are you|about yourself|তুমি কে|तुम कौन|आप कौन)/i],
  ['weather', /\b(weather|mausam|temperature|rain\b|বৃষ্টি|আবহাওয়া|मौसम|बारिश)\b/i],
  ['able', /(what can you do|how do you work|how can you help|কী করতে পার|क्या कर सकते|commands|features)/i],
  ['greet', /^(hi+|hii+|hello|hey|namaste|namaskar|good (morning|afternoon|evening)|নমস্কার|नमस्ते)\b/i],
]

export function smallTalkKind(q: string): ChatKind | undefined {
  const s = q.trim()
  if (s.length > 60) return undefined // a long message is never just chit-chat
  for (const [kind, re] of CHAT) if (re.test(s)) return kind
  return undefined
}

/** Chit-chat only when nothing audit-related is in the question. */
export function chitChat(question: string, d: Data): ChatKind | undefined {
  if (knownIds(question, d).length) return undefined
  if (/\bPO-\d{4}-\d+\b|\bF-[A-Za-z0-9-]*\d[A-Za-z0-9-]*/i.test(question)) return undefined
  if (intent(question) !== 'help') return undefined
  return smallTalkKind(question)
}

function smallTalk(kind: ChatKind, f: Facts, t: Tr): string {
  switch (kind) {
    case 'thanks':
      return t(`You're welcome! Anything else — a risk, a due, a delay?`,
        `আপনাকে স্বাগতম! আর কিছু — কোনো ঝুঁকি, বকেয়া বা দেরি?`,
        `आपका स्वागत है! और कुछ — कोई जोखिम, बकाया या देरी?`)
    case 'bye':
      return t(`Goodbye! I'll keep an eye on the audit data until next time.`,
        `বিদায়! পরের বার দেখা হওয়া পর্যন্ত নিরীক্ষার তথ্যের দিকে নজর রাখছি।`,
        `अलविदा! अगली बार तक मैं ऑडिट डेटा पर नज़र रखूँगा।`)
    case 'who':
      return t(`I'm the audit assistant inside TSICL's workspace. I read this quarter's documents, flag what looks wrong, and explain it in plain words — but I never decide. The auditor decides.`,
        `আমি TSICL কর্মক্ষেত্রের নিরীক্ষা সহকারী। এই ত্রৈমাসিকের নথি পড়ি, সমস্যা মনে হলে দেখাই, সহজ ভাষায় বুঝিয়ে দিই — কিন্তু সিদ্ধান্ত নিই না। সিদ্ধান্ত নেবেন নিরীক্ষক।`,
        `मैं TSICL कार्यक्षेत्र का ऑडिट सहायक हूँ। इस तिमाही के दस्तावेज़ पढ़ता हूँ, गड़बड़ दिखे तो दिखाता हूँ, आसान भाषा में समझाता हूँ — पर निर्णय नहीं लेता। निर्णय ऑडिटर का है।`)
    case 'weather':
      return t(`I don't have a live weather feed, so I can't tell you today's weather. If you like, ask me anything else — or ask what needs attention in this quarter's audit: **${f.findings.length} open findings** right now.`,
        `আমার কাছে সরাসরি আবহাওয়ার তথ্য নেই, তাই আজকের আবহাওয়া বলতে পারব না। চাইলে অন্য কিছু জিজ্ঞেস করুন — অথবা জিজ্ঞেস করুন এই ত্রৈমাসিকের নিরীক্ষায় কী দেখা দরকার: এখন **${f.findings.length}টি খোলা ফাইন্ডিং** আছে।`,
        `मेरे पास लाइव मौसम की जानकारी नहीं है, इसलिए आज का मौसम नहीं बता सकता। चाहें तो कुछ और पूछिए — या पूछिए इस तिमाही के ऑडिट में क्या देखना है: अभी **${f.findings.length} खुले निष्कर्ष** हैं।`)
    case 'able':
      return t(`I can: explain any finding or PO by its ID, list the biggest risks, tell you who owes money and for how long, say which department is late with documents, draft reminder emails, and brief you for the Board. Try: "What are the 3 biggest risks?"`,
        `আমি পারি: নম্বর দিয়ে যেকোনো ফাইন্ডিং বা PO বুঝিয়ে দেওয়া, বড় ঝুঁকিগুলো বলা, কে কতদিন ধরে টাকা বাকি রেখেছে বলা, কোন বিভাগ নথিতে দেরি করছে বলা, স্মরণ-চিঠির খসড়া করা, বোর্ডের জন্য সারসংক্ষেপ দেওয়া। চেষ্টা করুন: "What are the 3 biggest risks?"`,
        `मैं कर सकता हूँ: नंबर से कोई निष्कर्ष या PO समझाना, बड़े जोखिम बताना, कौन कितने समय से पैसा बाकी रखे है बताना, कौन-सा विभाग दस्तावेज़ों में देर कर रहा है बताना, याद-पत्र का मसौदा बनाना, बोर्ड के लिए सार देना। आज़माइए: "What are the 3 biggest risks?"`)
    case 'greet':
      return t(`Hello! Ask me about risks, dues, delays, or any finding ID — or just say what's on your mind. Right now there are **${f.findings.length} open findings** worth a look.`,
        `নমস্কার! ঝুঁকি, বকেয়া, দেরি বা যেকোনো ফাইন্ডিং নম্বর সম্পর্কে জিজ্ঞেস করুন — অথবা মনে যা আছে বলুন। এখন **${f.findings.length}টি খোলা ফাইন্ডিং** দেখার মতো আছে।`,
        `नमस्ते! जोखिम, बकाया, देरी या किसी निष्कर्ष नंबर के बारे में पूछिए — या बस बताइए क्या चल रहा है। अभी **${f.findings.length} खुले निष्कर्ष** देखने लायक हैं।`)
  }
}

/** Offline answer for chit-chat (used when the live model is unreachable, even in demo mode). */
export function chitChatAnswer(kind: ChatKind, d: Data, lang: Lang): string {
  const f = computeFacts(d)
  const t: Tr = (en, bn, hi) => (lang === 'bn' ? bn : lang === 'hi' ? hi : en) ?? en
  return smallTalk(kind, f, t)
}

const SEV_BN = { critical: 'জরুরি', high: 'গুরুত্বপূর্ণ', medium: 'শীঘ্র দেখুন', low: 'সামান্য' }
const SEV_HI = { critical: 'ज़रूरी', high: 'महत्वपूर्ण', medium: 'जल्द जाँचें', low: 'मामूली' }
const DISCLAIMER = (t: Tr) => t(
  'These are AI-assisted flags, not conclusions. The auditor decides.',
  'এগুলো AI-সহায়তায় পাওয়া সতর্কতা, সিদ্ধান্ত নয়। সিদ্ধান্ত নেবেন অডিটর।',
  'ये AI-सहायता से मिले संकेत हैं, निष्कर्ष नहीं। निर्णय ऑडिटर का है।',
)
/** Last line of every answer: the findings and documents it is based on. The UI renders it as source chips. */
const based = (...refs: (string | undefined)[]) => {
  const u = [...new Set(refs.filter(Boolean))].slice(0, 8)
  return u.length ? `Based on: ${u.join(', ')}` : ''
}
const refsOf = (fs: Finding[]) => fs.flatMap((x) => [x.id, ...x.evidence.map((e) => e.label)])

export function answer(question: string, d: Data, lang: Lang = 'en'): string {
  const f = computeFacts(d)
  const t: Tr = (en, bn, hi) => (lang === 'bn' ? bn : lang === 'hi' ? hi : en) ?? en
  const sev = (s: Finding['severity']) => (lang === 'bn' ? SEV_BN[s] : lang === 'hi' ? SEV_HI[s] : SEV_WORD[s])

  const mentioned = knownIds(question, d)[0]
  if (mentioned) return mentioned.kind === 'po' ? explainPO(d, f, t, mentioned.id) : explainFinding(d, f, t, sev, mentioned.id)
  const unknown = question.match(/\bPO-\d{4}-\d+\b|\bF-[A-Za-z0-9-]*\d[A-Za-z0-9-]*/i)?.[0]
  if (unknown) return /^po/i.test(unknown) ? explainPO(d, f, t, unknown) : explainFinding(d, f, t, sev, unknown)

  switch (intent(question)) {
    case 'risk': return risks(f, t, sev)
    case 'money': return money(d, f, t)
    case 'late': return lateDocs(f, t)
    case 'draft': return draftReminder(d, f, t, question)
    case 'board': return board(f, t)
    case 'asset': return assets(d, f, t)
    case 'buy': return buying(d, f, t)
    default: return help(f, t)
  }
}

// ---------------------------------------------------------------- intents

function risks(f: Facts, t: Tr, sev: (s: Finding['severity']) => string) {
  const top = f.findings.slice(0, 3)
  if (!top.length) return t('There are no open findings right now. Nothing needs your attention.', 'এখন কোনো খোলা ফাইন্ডিং নেই। আপনার মনোযোগ দরকার এমন কিছু নেই।', 'अभी कोई खुला निष्कर्ष नहीं है। आपके ध्यान की ज़रूरत वाली कोई बात नहीं।')
  const sum = top.reduce((s, x) => s + x.amount, 0)
  const lines = top.map((x, i) => `${i + 1}. ${x.id} **${x.title}**\n   ${sev(x.severity)} · ${formatINRShort(x.amount)} · ${f.division(x.divisionId)}\n   ${x.summary}`)
  return [
    t(`Here are the **${top.length} biggest risks** right now. Together they put **${formatINRShort(sum)}** at stake.`,
      `এখনকার **${top.length}টি সবচেয়ে বড় ঝুঁকি** এখানে। সব মিলিয়ে **${formatINRShort(sum)}** ঝুঁকিতে আছে।`,
      `अभी के **${top.length} सबसे बड़े जोखिम** ये हैं। कुल मिलाकर **${formatINRShort(sum)}** दांव पर है।`),
    lines.join('\n'),
    t(`In all there are **${f.findings.length} open findings**: ${f.bySeverity.critical} urgent, ${f.bySeverity.high} important, ${f.bySeverity.medium} check soon, ${f.bySeverity.low} minor.`,
      `মোট **${f.findings.length}টি খোলা ফাইন্ডিং**: ${f.bySeverity.critical} জরুরি, ${f.bySeverity.high} গুরুত্বপূর্ণ, ${f.bySeverity.medium} শীঘ্র দেখুন, ${f.bySeverity.low} সামান্য।`,
      `कुल **${f.findings.length} खुले निष्कर्ष**: ${f.bySeverity.critical} ज़रूरी, ${f.bySeverity.high} महत्वपूर्ण, ${f.bySeverity.medium} जल्द जाँचें, ${f.bySeverity.low} मामूली।`),
    DISCLAIMER(t),
    based(...refsOf(top)),
  ].join('\n\n')
}

function money(d: Data, f: Facts, t: Tr) {
  const r = f.recv
  if (!r.count) return t('No money is recorded as owed by customers right now.', 'এখন গ্রাহকদের কাছে কোনো বকেয়া টাকা নথিভুক্ত নেই।', 'अभी ग्राहकों पर कोई बकाया राशि दर्ज नहीं है।')
  const pct = r.total ? Math.round((r.over90 / r.total) * 100) : 0
  const labels = [
    t('0–30 days', '০–৩০ দিন', '0–30 दिन'), t('31–60 days', '৩১–৬০ দিন', '31–60 दिन'),
    t('61–90 days', '৬১–৯০ দিন', '61–90 दिन'), t('Over 90 days', '৯০ দিনের বেশি', '90 दिन से अधिक'),
  ]
  const ageing = r.buckets.map((b, i) => `- ${labels[i]}: **${formatINRShort(b.amount)}** (${b.count})`)
  const dues = r.topCustomers.slice(0, 3).map((c) => `- **${c.customer}** — ${formatINRShort(c.amount)} · ${t('oldest invoice', 'সবচেয়ে পুরনো বিল', 'सबसे पुराना बिल')} ${c.oldest} ${t('days', 'দিন', 'दिन')} · ${c.division}`)
  const related = f.findings.find((x) => x.area === 'receivables')
  return [
    t(`Customers owe TSICL **${formatINRShort(r.total)}** across **${r.count} unpaid invoices**. **${formatINRShort(r.over90)}** (${pct}%) is more than 90 days old. This is the money most likely to get stuck.`,
      `গ্রাহকদের কাছে TSICL-এর মোট **${formatINRShort(r.total)}** বকেয়া, **${r.count}টি অপরিশোধিত বিলে**। এর **${formatINRShort(r.over90)}** (${pct}%) ৯০ দিনের বেশি পুরনো, যা আটকে যাওয়ার ঝুঁকি সবচেয়ে বেশি।`,
      `ग्राहकों पर TSICL का कुल **${formatINRShort(r.total)}** बकाया है, **${r.count} अवैतनिक बिलों** में। इसमें **${formatINRShort(r.over90)}** (${pct}%) 90 दिन से पुराना है, जिसके फँसने का जोखिम सबसे अधिक है।`),
    ageing.join('\n'),
    `**${t('Biggest dues', 'সবচেয়ে বড় বকেয়া', 'सबसे बड़े बकाया')}**\n${dues.join('\n')}`,
    r.unmatched.length
      ? t(`${r.unmatched.length} bank receipts worth **${formatINRShort(r.unmatched.reduce((s, x) => s + x.amount, 0))}** are not matched to any invoice yet. Some of these dues may already be paid.`,
          `${r.unmatched.length}টি ব্যাংক জমা (**${formatINRShort(r.unmatched.reduce((s, x) => s + x.amount, 0))}**) এখনও কোনো বিলের সঙ্গে মেলানো হয়নি। কিছু বকেয়া হয়তো ইতিমধ্যে শোধ হয়েছে।`,
          `${r.unmatched.length} बैंक जमा (**${formatINRShort(r.unmatched.reduce((s, x) => s + x.amount, 0))}**) अभी किसी बिल से नहीं मिलाए गए हैं। कुछ बकाया शायद पहले ही चुकाए जा चुके हों।`)
      : '',
    related ? `${t('Related finding', 'সংশ্লিষ্ট ফাইন্ডিং', 'संबंधित निष्कर्ष')}: ${related.id} ${related.title}` : '',
    DISCLAIMER(t),
    based(related?.id, ...d.receivables.slice().sort((a, b) => b.amount - a.amount).slice(0, 4).map((x) => x.invoiceNo)),
  ].filter(Boolean).join('\n\n')
}

function lateDocs(f: Facts, t: Tr) {
  if (!f.late.length) return t('No department is behind on documents right now. Every request is on time or complete.', 'এই মুহূর্তে কোনো বিভাগ নথি জমায় পিছিয়ে নেই। সব অনুরোধ সময়মতো বা সম্পূর্ণ।', 'अभी कोई विभाग दस्तावेज़ों में पीछे नहीं है। सभी अनुरोध समय पर या पूरे हैं।')
  const stage: Record<string, string> = {
    sent: t('first request sent', 'প্রথম অনুরোধ পাঠানো হয়েছে', 'पहला अनुरोध भेजा गया'),
    reminder_1: t('1st reminder sent', '১ম রিমাইন্ডার পাঠানো হয়েছে', 'पहला रिमाइंडर भेजा गया'),
    reminder_2: t('2nd reminder sent', '২য় রিমাইন্ডার পাঠানো হয়েছে', 'दूसरा रिमाइंडर भेजा गया'),
    escalated: t('escalated', 'ঊর্ধ্বতনকে জানানো হয়েছে', 'वरिष्ठ को सूचित किया गया'),
  }
  const lines = f.late.slice(0, 6).map((l) => {
    const total = l.req.items.length
    return `- **${l.division}**: ${l.pending.length}/${total} ${t('documents pending', 'নথি বাকি', 'दस्तावेज़ बाकी')}` +
      (l.daysLate > 0 ? ` · ${l.daysLate} ${t('days past deadline', 'দিন সময়সীমা পেরিয়ে', 'दिन समय-सीमा के बाद')}` : '') +
      ` · ${stage[l.req.stage] ?? l.req.stage}\n  ${l.pending.slice(0, 3).join(', ')}${l.pending.length > 3 ? '…' : ''}`
  })
  const worst = f.late[0]
  return [
    t(`**${f.late.length} ${f.late.length === 1 ? 'department is' : 'departments are'} late** with documents. The most overdue is **${worst.division}**.`,
      `**${f.late.length}টি বিভাগ** নথি জমায় দেরি করছে। সবচেয়ে বেশি দেরি **${worst.division}**-এর।`,
      `**${f.late.length} विभाग** दस्तावेज़ देने में देरी कर रहे हैं। सबसे ज़्यादा देरी **${worst.division}** की है।`),
    lines.join('\n'),
    t(`Want me to write a reminder? Ask: "Draft a reminder to ${worst.division}".`, `রিমাইন্ডার লিখে দেব? বলুন: "Draft a reminder to ${worst.division}"।`, `रिमाइंडर लिख दूँ? कहिए: "Draft a reminder to ${worst.division}"।`),
    based(...f.late.slice(0, 4).map((l) => l.req.id)),
  ].join('\n\n')
}

const TONE: Record<string, string> = { sent: 'a gentle reminder', reminder_1: 'a second reminder', reminder_2: 'a final reminder', escalated: 'an urgent reminder (this has already been escalated)' }
const GENERIC_WORDS = new Set(['division', 'unit', 'office', 'head', 'tsicl', 'corporation', 'centre', 'center', 'project', 'agartala'])

function draftReminder(d: Data, f: Facts, t: Tr, question: string) {
  const q = question.toLowerCase()
  // Match a unit by any distinctive word of its name or location.
  const scored = d.divisions.map((dv) => {
    const words = `${dv.name} ${dv.location}`.toLowerCase().split(/[^a-zঀ-৿ऀ-ॿ]+/).filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w))
    return { dv, score: words.filter((w) => q.includes(w)).length }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  const worst = f.late[0]
  const dv = scored[0]?.dv ?? (worst ? d.divisions.find((x) => x.id === worst.req.divisionId) : undefined)
  if (!dv) return t('I could not find a department to write to. Open Requests to pick one.', 'কোন বিভাগকে লিখব তা খুঁজে পাইনি। অনুরোধ পাতা থেকে একটি বেছে নিন।', 'किस विभाग को लिखना है यह नहीं मिला। अनुरोध पेज से एक चुनें।')
  const lr = f.late.find((l) => l.req.divisionId === dv.id) ?? d.requests.filter((r) => r.divisionId === dv.id && r.stage !== 'completed').map((req) => ({ req, division: dv.name, pending: req.items.filter((i) => !i.received).map((i) => i.label), daysLate: 0 })).find((l) => l.pending.length)
  if (!lr) return t(`**${dv.name}** has nothing pending, so there is nothing to chase. ${f.late.length ? `Departments still behind: ${f.late.map((l) => l.division).join(', ')}.` : ''}`, `**${dv.name}**-এর কিছু বাকি নেই, তাই তাগাদা দেওয়ার কিছু নেই।`, `**${dv.name}** का कुछ भी बाकी नहीं है, इसलिए याद दिलाने की ज़रूरत नहीं।`)
  const note = scored[0] ? '' : t(`I could not match a unit name, so I picked the most overdue one: **${dv.name}**.\n\n`, `ইউনিটের নাম মেলেনি, তাই সবচেয়ে দেরি করা **${dv.name}** বেছে নিয়েছি।\n\n`, `यूनिट का नाम नहीं मिला, इसलिए सबसे ज़्यादा देरी वाला **${dv.name}** चुना है।\n\n`)
  const when = lr.daysLate > 0 ? `, and were due on ${formatDate(lr.req.deadline)} (${lr.daysLate} days ago)` : `, due by ${formatDate(lr.req.deadline)}`
  return note + [
    t('Here is a draft you can send. Please review it first.', 'পাঠানোর মতো একটি খসড়া এখানে। পাঠানোর আগে দেখে নিন।', 'भेजने लायक एक ड्राफ्ट यहाँ है। भेजने से पहले देख लें।'),
    [
      `> **To:** ${dv.officer} (${dv.name}) <${dv.email}>`,
      `> **Subject:** Reminder: pending audit documents — ${lr.req.subject}`,
      '>',
      `> Dear ${dv.officer},`,
      '>',
      `> This is ${TONE[lr.req.stage] ?? 'a reminder'} from the Internal Audit team. We asked for the documents below on ${formatDate(lr.req.sentAt)}${when}. They are still pending:`,
      '>',
      ...lr.pending.map((p) => `> - ${p}`),
      '>',
      '> Please send them within 3 working days so the quarterly audit is not held up. If a document does not exist or cannot be shared, kindly tell us the reason in your reply.',
      '>',
      '> Thank you,',
      '> Internal Audit Team, TSICL',
    ].join('\n'),
    t('AI drafted this. Nothing is sent until you send it.', 'AI এটি লিখেছে। আপনি না পাঠালে কিছুই যাবে না।', 'यह AI ने लिखा है। आप भेजेंगे तभी जाएगा।'),
    based(lr.req.id),
  ].join('\n\n')
}

function board(f: Facts, t: Tr) {
  const top = f.findings.slice(0, 3)
  const r = f.recv
  const w = f.late[0]
  const lines = [
    t(`The audit has raised **${f.findings.length} open findings** (${f.bySeverity.critical} urgent, ${f.bySeverity.high} important), with **${formatINRShort(f.atRisk)}** at stake.`,
      `অডিটে **${f.findings.length}টি খোলা ফাইন্ডিং** উঠেছে (${f.bySeverity.critical} জরুরি, ${f.bySeverity.high} গুরুত্বপূর্ণ), মোট **${formatINRShort(f.atRisk)}** ঝুঁকিতে।`,
      `ऑडिट में **${f.findings.length} खुले निष्कर्ष** मिले (${f.bySeverity.critical} ज़रूरी, ${f.bySeverity.high} महत्वपूर्ण), कुल **${formatINRShort(f.atRisk)}** दांव पर।`),
    top.length ? `${t('Top concerns', 'প্রধান উদ্বেগ', 'मुख्य चिंताएँ')}: ${top.map((x) => `${x.id} ${x.title} (${formatINRShort(x.amount)})`).join('; ')}.` : '',
    r.count ? t(`Customers owe **${formatINRShort(r.total)}**; **${formatINRShort(r.over90)}** is over 90 days old.`, `গ্রাহকদের কাছে **${formatINRShort(r.total)}** বকেয়া; এর **${formatINRShort(r.over90)}** ৯০ দিনের বেশি পুরনো।`, `ग्राहकों पर **${formatINRShort(r.total)}** बकाया है; इसमें **${formatINRShort(r.over90)}** 90 दिन से पुराना है।`) : '',
    f.late.length ? t(`**${f.late.length}** departments are late with documents; the most overdue is ${w.division} (${Math.max(w.daysLate, 0)} days).`, `**${f.late.length}টি** বিভাগ নথি জমায় দেরি করছে; সবচেয়ে বেশি ${w.division} (${Math.max(w.daysLate, 0)} দিন)।`, `**${f.late.length}** विभाग दस्तावेज़ों में देरी कर रहे हैं; सबसे ज़्यादा ${w.division} (${Math.max(w.daysLate, 0)} दिन)।`) : t('All departments are on time with documents.', 'সব বিভাগ নথি জমায় সময়মতো।', 'सभी विभाग दस्तावेज़ों में समय पर हैं।'),
    f.assets.total ? t(`**${f.assets.pct}%** of assets are physically verified; ${f.assets.missing} found missing.`, `সম্পদের **${f.assets.pct}%** সরেজমিনে যাচাই হয়েছে; ${f.assets.missing}টি পাওয়া যায়নি।`, `संपत्तियों का **${f.assets.pct}%** भौतिक रूप से सत्यापित है; ${f.assets.missing} नहीं मिलीं।`) : '',
    f.buy.count ? t(`**${f.buy.overLimit.length}** purchases went above the approver's limit and **${f.buy.singleQuote.length}** had a single quotation.`, `**${f.buy.overLimit.length}টি** ক্রয় অনুমোদনকারীর সীমা ছাড়িয়েছে এবং **${f.buy.singleQuote.length}টিতে** একটিই কোটেশন ছিল।`, `**${f.buy.overLimit.length}** खरीद स्वीकृतिकर्ता की सीमा से ऊपर गईं और **${f.buy.singleQuote.length}** में एक ही कोटेशन था।`) : '',
    t(`Auditor decisions so far: ${f.decided.confirmed} confirmed, ${f.decided.rejected} rejected, ${f.decided.open} still open.`, `অডিটরের সিদ্ধান্ত এখন পর্যন্ত: ${f.decided.confirmed} নিশ্চিত, ${f.decided.rejected} বাতিল, ${f.decided.open} খোলা।`, `ऑडिटर के निर्णय अब तक: ${f.decided.confirmed} पुष्ट, ${f.decided.rejected} अस्वीकृत, ${f.decided.open} खुले।`),
  ].filter(Boolean).map((x) => `- ${x}`)
  return [
    `**${t('What to tell the Board: Q2 FY 2026-27', 'বোর্ডকে কী বলবেন: Q2 FY 2026-27', 'बोर्ड को क्या बताएँ: Q2 FY 2026-27')}**`,
    lines.join('\n'),
    t('The CA firm reviews and signs off the final report. This is an AI-assisted brief.', 'চূড়ান্ত রিপোর্ট CA ফার্ম দেখে স্বাক্ষর করবে। এটি AI-সহায়তায় তৈরি সংক্ষিপ্ত বিবরণ।', 'अंतिम रिपोर्ट CA फ़र्म जाँचकर हस्ताक्षर करेगी। यह AI-सहायता से तैयार संक्षिप्त विवरण है।'),
    based(...refsOf(top)),
  ].join('\n\n')
}

function assets(d: Data, f: Facts, t: Tr) {
  const a = f.assets
  if (!a.total) return t('No assets are recorded yet.', 'এখনও কোনো সম্পদ নথিভুক্ত নেই।', 'अभी कोई संपत्ति दर्ज नहीं है।')
  const unverified = a.unverifiedTop.slice(0, 3).map((x) => `- **${x.tag}** ${x.name} — ${formatINRShort(x.cost)} · ${x.location}`)
  const related = f.findings.find((x) => x.area === 'fixed_assets')
  return [
    t(`**${a.pct}%** of the ${a.total} assets (worth ${formatINRShort(a.cost)}) have been physically verified. ${a.found} found, **${a.missing} missing**, ${a.damaged} damaged, ${a.never} not checked yet.`,
      `${a.total}টি সম্পদের (মূল্য ${formatINRShort(a.cost)}) **${a.pct}%** সরেজমিনে যাচাই হয়েছে। ${a.found}টি পাওয়া গেছে, **${a.missing}টি নেই**, ${a.damaged}টি ক্ষতিগ্রস্ত, ${a.never}টি এখনও দেখা হয়নি।`,
      `${a.total} संपत्तियों (मूल्य ${formatINRShort(a.cost)}) में से **${a.pct}%** का भौतिक सत्यापन हुआ है। ${a.found} मिलीं, **${a.missing} गायब**, ${a.damaged} क्षतिग्रस्त, ${a.never} अभी जाँची नहीं गईं।`),
    unverified.length ? `**${t('Highest-value assets not yet checked', 'সবচেয়ে বেশি দামের যে সম্পদ এখনও দেখা হয়নি', 'सबसे अधिक मूल्य की संपत्तियाँ जो अभी जाँची नहीं गईं')}**\n${unverified.join('\n')}` : '',
    related ? `${t('Related finding', 'সংশ্লিষ্ট ফাইন্ডিং', 'संबंधित निष्कर्ष')}: ${related.id} ${related.title}` : '',
    d.assets.length ? t('Open Assets and use "scan & verify" to check items on site.', 'সরেজমিনে দেখতে সম্পদ পাতায় "scan & verify" ব্যবহার করুন।', 'मौके पर जाँच के लिए संपत्ति पेज पर "scan & verify" का उपयोग करें।') : '',
    based(...a.unverifiedTop.slice(0, 3).map((x) => x.tag), related?.id),
  ].filter(Boolean).join('\n\n')
}

function buying(_d: Data, f: Facts, t: Tr) {
  const b = f.buy
  if (!b.count) return t('No purchase orders are recorded yet.', 'এখনও কোনো ক্রয়াদেশ নথিভুক্ত নেই।', 'अभी कोई खरीद आदेश दर्ज नहीं है।')
  const over = b.overLimit.slice(0, 3).map((p) => `- ${p.id} **${p.vendor}** — ${formatINR(p.amount)} ${t('vs limit', 'সীমা', 'सीमा')} ${formatINR(p.approverLimit)} (${p.approvedBy})`)
  const vendors = b.topVendors.slice(0, 3).map((v) => `- **${v.vendor}** — ${formatINRShort(v.value)} (${v.share}%)`)
  const related = f.findings.filter((x) => x.area === 'procurement').slice(0, 2)
  return [
    t(`TSICL has **${b.count} purchase orders** worth **${formatINRShort(b.value)}**. **${b.overLimit.length}** were approved above the approver's limit and **${b.singleQuote.length}** had only one quotation.`,
      `TSICL-এর **${b.count}টি ক্রয়াদেশ**, মোট **${formatINRShort(b.value)}**। **${b.overLimit.length}টি** অনুমোদনকারীর সীমার বেশি টাকায় অনুমোদিত এবং **${b.singleQuote.length}টিতে** একটিই কোটেশন।`,
      `TSICL के **${b.count} खरीद आदेश** हैं, कुल **${formatINRShort(b.value)}**। **${b.overLimit.length}** स्वीकृतिकर्ता की सीमा से ऊपर पास हुए और **${b.singleQuote.length}** में सिर्फ़ एक कोटेशन था।`),
    over.length ? `**${t('Above the approver\'s limit', 'অনুমোদনকারীর সীমার বেশি', 'स्वीकृतिकर्ता की सीमा से ऊपर')}**\n${over.join('\n')}` : '',
    `**${t('Biggest vendors', 'বড় বিক্রেতা', 'सबसे बड़े विक्रेता')}**\n${vendors.join('\n')}`,
    related.length ? `${t('Related findings', 'সংশ্লিষ্ট ফাইন্ডিং', 'संबंधित निष्कर्ष')}: ${related.map((x) => `${x.id} ${x.title}`).join('; ')}` : '',
    DISCLAIMER(t),
    based(...b.overLimit.slice(0, 3).map((p) => p.id), ...related.map((x) => x.id)),
  ].filter(Boolean).join('\n\n')
}

function help(f: Facts, t: Tr) {
  return [
    t(`I answer from this quarter's audit data. Right now: **${f.findings.length} open findings** (${formatINRShort(f.atRisk)} at stake), customers owe **${formatINRShort(f.recv.total)}**, **${f.late.length}** departments are late with documents, and **${f.assets.pct}%** of assets are verified.`,
      `আমি এই ত্রৈমাসিকের অডিট তথ্য থেকে উত্তর দিই। এখন: **${f.findings.length}টি খোলা ফাইন্ডিং** (${formatINRShort(f.atRisk)} ঝুঁকিতে), গ্রাহকদের কাছে **${formatINRShort(f.recv.total)}** বকেয়া, **${f.late.length}টি** বিভাগ নথিতে পিছিয়ে, আর **${f.assets.pct}%** সম্পদ যাচাই হয়েছে।`,
      `मैं इस तिमाही के ऑडिट डेटा से जवाब देता हूँ। अभी: **${f.findings.length} खुले निष्कर्ष** (${formatINRShort(f.atRisk)} दांव पर), ग्राहकों पर **${formatINRShort(f.recv.total)}** बकाया, **${f.late.length}** विभाग दस्तावेज़ों में पीछे, और **${f.assets.pct}%** संपत्तियाँ सत्यापित।`),
    t('Try: "What are the 3 biggest risks?", "How much money is stuck with customers?", or a finding or PO number like F-247.', 'জিজ্ঞেস করুন: "What are the 3 biggest risks?", "How much money is stuck with customers?", বা F-247 এর মতো ফাইন্ডিং/PO নম্বর।', 'पूछिए: "What are the 3 biggest risks?", "How much money is stuck with customers?", या F-247 जैसा निष्कर्ष/PO नंबर।'),
  ].join('\n\n')
}

// ---------------------------------------------------------------- explain a PO / a finding

function explainPO(d: Data, f: Facts, t: Tr, id: string) {
  const p = findPO(d, id)
  if (!p) return t(`I could not find ${id} in the purchase records.`, `ক্রয় নথিতে ${id} খুঁজে পাইনি।`, `खरीद रिकॉर्ड में ${id} नहीं मिला।`)
  const issues = poIssues(p, t)
  const related = f.findings.filter((x) => x.evidence.some((e) => e.label === p.id) || `${x.title} ${x.summary} ${x.reason}`.includes(p.id))
  return [
    t(`**${p.id}** is a **${formatINR(p.amount)}** purchase of ${p.item} from **${p.vendor}** for ${f.division(p.divisionId)}, dated ${formatDate(p.date)}.`,
      `**${p.id}** হলো ${f.division(p.divisionId)}-এর জন্য **${p.vendor}** থেকে ${p.item} কেনার **${formatINR(p.amount)}**-এর ক্রয়াদেশ, তারিখ ${formatDate(p.date)}।`,
      `**${p.id}** ${f.division(p.divisionId)} के लिए **${p.vendor}** से ${p.item} की **${formatINR(p.amount)}** की खरीद है, दिनांक ${formatDate(p.date)}।`),
    issues.length
      ? `**${t('What looks wrong', 'কী সমস্যা মনে হচ্ছে', 'क्या गड़बड़ दिख रही है')}**\n${issues.map((x) => `- ${x}`).join('\n')}`
      : t('I do not see an approval, quotation or payment problem in the recorded data.', 'নথিভুক্ত তথ্যে অনুমোদন, কোটেশন বা পেমেন্টের কোনো সমস্যা দেখছি না।', 'दर्ज डेटा में स्वीकृति, कोटेशन या भुगतान की कोई समस्या नहीं दिखती।'),
    related.length ? `${t('Related findings', 'সংশ্লিষ্ট ফাইন্ডিং', 'संबंधित निष्कर्ष')}: ${related.map((x) => `${x.id} ${x.title}`).join('; ')}` : '',
    issues.length ? t('Why it matters: money was committed without the checks the rules require. Ask the division for the approval note and quotations before you decide. The auditor decides.', 'কেন গুরুত্বপূর্ণ: নিয়মে যে যাচাই দরকার তা ছাড়াই টাকা খরচের প্রতিশ্রুতি হয়েছে। সিদ্ধান্তের আগে বিভাগের কাছে অনুমোদন-নোট ও কোটেশন চান। সিদ্ধান্ত নেবেন অডিটর।', 'क्यों महत्वपूर्ण: नियमों में ज़रूरी जाँच के बिना पैसा खर्च करने की प्रतिबद्धता हुई। निर्णय से पहले विभाग से स्वीकृति-नोट और कोटेशन माँगें। निर्णय ऑडिटर का है।') : '',
    based(...related.map((x) => x.id), p.id),
  ].filter(Boolean).join('\n\n')
}

function poIssues(p: PurchaseOrder, t: Tr): string[] {
  const out: string[] = []
  if (p.amount > p.approverLimit) {
    out.push(t(`Approved by the **${p.approvedBy}**, who can only approve up to ${formatINR(p.approverLimit)}. That is **${formatINR(p.amount - p.approverLimit)} over** the limit.`,
      `**${p.approvedBy}** অনুমোদন করেছেন, কিন্তু তাঁর সীমা ${formatINR(p.approverLimit)}। অর্থাৎ সীমার চেয়ে **${formatINR(p.amount - p.approverLimit)} বেশি**।`,
      `**${p.approvedBy}** ने स्वीकृति दी, पर उनकी सीमा ${formatINR(p.approverLimit)} है। यानी सीमा से **${formatINR(p.amount - p.approverLimit)} अधिक**।`))
  }
  if (p.quotations <= 1) {
    out.push(t(`Only **${p.quotations} quotation** was collected, so there was little price competition.`, `মাত্র **${p.quotations}টি কোটেশন** নেওয়া হয়েছে, তাই দামের প্রতিযোগিতা প্রায় ছিল না।`, `सिर्फ़ **${p.quotations} कोटेशन** लिया गया, इसलिए दाम में प्रतिस्पर्धा लगभग नहीं थी।`))
  }
  if (p.invoiceAmount !== undefined && p.invoiceAmount > p.amount) {
    out.push(t(`The invoice is ${formatINR(p.invoiceAmount)}, which is **${formatINR(p.invoiceAmount - p.amount)} more** than the order value.`, `ইনভয়েস ${formatINR(p.invoiceAmount)}, যা অর্ডার মূল্যের চেয়ে **${formatINR(p.invoiceAmount - p.amount)} বেশি**।`, `इनवॉइस ${formatINR(p.invoiceAmount)} है, जो ऑर्डर मूल्य से **${formatINR(p.invoiceAmount - p.amount)} अधिक** है।`))
  }
  if (p.paymentDate && !p.grnDate) {
    out.push(t(`Paid on ${formatDate(p.paymentDate)}, but there is **no record that the goods were received**.`, `${formatDate(p.paymentDate)} তারিখে টাকা দেওয়া হয়েছে, কিন্তু **মাল গ্রহণের কোনো রেকর্ড নেই**।`, `${formatDate(p.paymentDate)} को भुगतान हुआ, पर **माल प्राप्त होने का कोई रिकॉर्ड नहीं** है।`))
  } else if (p.paymentDate && p.grnDate && p.paymentDate < p.grnDate) {
    out.push(t(`Paid on ${formatDate(p.paymentDate)}, **before** the goods arrived on ${formatDate(p.grnDate)}.`, `${formatDate(p.paymentDate)} তারিখে টাকা দেওয়া হয়েছে, মাল আসার (${formatDate(p.grnDate)}) **আগেই**।`, `${formatDate(p.paymentDate)} को भुगतान हुआ, माल आने (${formatDate(p.grnDate)}) से **पहले**।`))
  }
  return out
}

function explainFinding(d: Data, f: Facts, t: Tr, sev: (s: Finding['severity']) => string, id: string) {
  const x = findFinding(d, id)
  if (!x) return t(`I could not find a finding called ${id}.`, `${id} নামে কোনো ফাইন্ডিং খুঁজে পাইনি।`, `${id} नाम का कोई निष्कर्ष नहीं मिला।`)
  return [
    `**${x.id} · ${x.title}**`,
    `${sev(x.severity)} · ${formatINRShort(x.amount)} · ${f.division(x.divisionId)} · ${Math.round(x.confidence * 100)}% ${t('sure', 'নিশ্চিত', 'निश्चित')} · ${x.status}`,
    x.summary,
    `**${t('Why it was flagged', 'কেন চিহ্নিত হয়েছে', 'क्यों चिह्नित हुआ')}:** ${x.reason}`,
    x.evidence.length ? `**${t('Evidence', 'প্রমাণ', 'प्रमाण')}:** ${x.evidence.map((e) => e.label).join(', ')}` : '',
    t('You can confirm, reject or investigate it on the Findings page. The decision is yours; AI never decides.', 'ফাইন্ডিং পাতায় এটি নিশ্চিত, বাতিল বা তদন্ত করতে পারেন। সিদ্ধান্ত আপনার; AI সিদ্ধান্ত নেয় না।', 'निष्कर्ष पेज पर आप इसे पुष्ट, अस्वीकृत या जाँच में रख सकते हैं। निर्णय आपका है; AI निर्णय नहीं लेता।'),
    based(x.id, ...x.evidence.map((e) => e.label)),
  ].filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------- self-check
// Run in dev: window.__assistantSelfCheck?.()  (installed by Assistant.tsx), or from a script via vite ssrLoadModule.
export function selfCheck(): string {
  const s = seed()
  const d: Data = { ...s, findings: runRules(s) }
  const f = computeFacts(d)
  let n = 0
  const ok = (cond: unknown, msg: string) => { n++; if (!cond) throw new Error(`assistant selfCheck failed: ${msg}`) }

  const chips: [string, Intent | 'po'][] = [
    ['What are the 3 biggest risks?', 'risk'], ['How much money is stuck with customers?', 'money'],
    ['Which department is late with documents?', 'late'], ['Explain the PO-2026-184 issue simply', 'po'],
    ['Draft a reminder to Udaipur Unit', 'draft'], ['What should I tell the Board?', 'board'],
  ]
  for (const [q, want] of chips) {
    if (want !== 'po') ok(intent(q) === want, `intent("${q}") should be ${want}, got ${intent(q)}`)
    for (const lang of ['en', 'bn', 'hi'] as const) {
      const a = answer(q, d, lang)
      ok(a.length > 40 && !/undefined|NaN|\[object/.test(a), `bad answer for "${q}" (${lang}): ${a.slice(0, 80)}`)
    }
  }
  for (const [q, want] of [['asset verification status', 'asset'], ['which vendor gets most purchases', 'buy'], ['hello', 'help'], ['ঝুঁকি কী', 'risk'], ['बकाया कितना है', 'money']] as const) ok(intent(q) === want, `intent("${q}") should be ${want}`)

  if (f.findings.length) {
    const top = f.findings[0]
    ok(answer('biggest risks', d).includes(top.id), 'risk answer must cite the top finding')
    ok(answer('biggest risks', d).split('\n\n').at(-1)!.startsWith(`Based on: ${top.id}`), 'risk answer must end with a Based on line')
    ok(answer(`explain ${top.id}`, d).includes(`Based on: ${top.id}`), 'finding answer must end with a Based on line')
    ok(answer('biggest risks', d, 'bn').includes(top.id), 'bn risk answer must cite the top finding')
    ok(answer(`explain ${top.id}`, d).includes(top.title), 'finding explain must include the title')
    ok(linkIds(`see ${top.id}`, d).includes(`(/findings/${top.id})`), 'linkIds must link a known finding')
  }
  ok(!linkIds('see F-99999 and PO-1999-1', d).includes(']('), 'linkIds must not link unknown ids')
  ok(answer('explain F-99999', d).includes('F-99999'), 'unknown finding answer should name the id')
  if (f.recv.count) ok(answer('money owed', d).includes(formatINRShort(f.recv.total)), 'money answer must show the real total')
  if (f.late.length) ok(answer('which department is late', d).includes(f.late[0].division), 'late answer must name the worst department')
  const po = findPO(d, 'PO-2026-184')
  if (po) {
    const a = answer('Explain the PO-2026-184 issue simply', d)
    ok(a.includes(formatINR(po.amount)), 'PO answer must show the amount')
    ok(a.includes('Based on:') && a.split('Based on:')[1].includes(po.id), 'PO answer must cite the PO')
    if (po.amount > po.approverLimit) ok(a.includes(formatINR(po.amount - po.approverLimit)), 'PO answer must show the overage')
    ok(linkIds('PO-2026-184', d) === '[PO-2026-184](/procurement)', 'linkIds must link a known PO')
  }
  // chit-chat routes to small talk, audit questions never do
  for (const [q, want] of [['hello', 'greet'], ['thanks a lot', 'thanks'], ['what is the weather like', 'weather'], ['who are you', 'who'], ['bye for now', 'bye'], ['what can you do', 'able']] as const)
    ok(chitChat(q, d) === want, `chitChat("${q}") should be ${want}, got ${chitChat(q, d)}`)
  for (const q of ['hello, what are the risks?', 'thanks, now show money owed', 'PO-2026-184', 'weather damage to assets']) ok(!chitChat(q, d), `chitChat("${q}") must stay on the audit path`)
  for (const lang of ['en', 'bn', 'hi'] as const) {
    const g = chitChatAnswer('greet', d, lang)
    const w = chitChatAnswer('weather', d, lang)
    ok(g.length > 20 && w.length > 20 && !/undefined|NaN|\[object/.test(g + w), `bad small-talk (${lang})`)
  }
  return `assistant selfCheck ok (${n} checks)`
}
