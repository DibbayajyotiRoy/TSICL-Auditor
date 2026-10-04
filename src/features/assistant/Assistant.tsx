"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Mic, SendHorizontal } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { BotAvatar } from "bot-avatars";
import { VoiceBeam, useMicrophone } from "voice-glow";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { Markdown } from "@/components/ui/markdown";
import { useAudit } from "@/data/store";
import { useT } from "@/lib/i18n";
import { play } from "@/lib/sound";
import { useUI } from "@/lib/ui";
import type { Lang } from "@/lib/ui";
import { respond } from "./ask";
import type { Msg } from "./ask";
import { linkIds } from "./facts";

// English suggested questions from the offline brain's self-check.
// Each chip is sent as both `question` and `canon` so the offline brain routes it.
const CHIPS = [
  "What are the 3 biggest risks?",
  "How much money is stuck with customers?",
  "Which department is late with documents?",
  "Explain the PO-2026-184 issue simply",
  "Draft a reminder to Udaipur Unit",
  "What should I tell the Board?",
];

const SR_LANG: Record<Lang, string> = { en: "en-IN", bn: "bn-IN", hi: "hi-IN" };

const STATUS = "Reading audit data…";

interface AnySpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function Assistant() {
  const open = useUI((s) => s.assistantOpen);
  const assistantPrompt = useUI((s) => s.assistantPrompt);
  const closeAssistant = useUI((s) => s.closeAssistant);
  const lang = useUI((s) => s.lang);
  const demoMode = useUI((s) => s.demoMode);
  const t = useT();
  const { resolvedTheme } = useTheme();
  const mic = useMicrophone();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [srLive, setSrLive] = useState(false);
  const idRef = useRef(1);
  const recogRef = useRef<AnySpeechRecognition | null>(null);
  const consumedRef = useRef<string | null>(null);

  // VoiceBeam theme must be explicit (never left on default).
  const beamTheme = resolvedTheme === "dark" ? "dark" : "light";

  const send = useCallback(
    async (question: string, canon?: string) => {
      const q = question.trim();
      if (!q || loading) return;
      const userMsg: Msg = { id: idRef.current++, role: "user", text: q };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setLoading(true);
      try {
        const { text, source } = await respond(q, canon ?? undefined, history, lang);
        setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text, source }]);
        play("success");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, lang],
  );

  // Sound on open.
  useEffect(() => {
    if (open) play("open");
  }, [open ]);

  // Auto-ask a prompt pushed via openAssistant(prompt), exactly once.
  useEffect(() => {
    if (!open || !assistantPrompt) {
      if (!assistantPrompt) consumedRef.current = null;
      return;
    }
    if (consumedRef.current === assistantPrompt) return;
    consumedRef.current = assistantPrompt;
    const p = assistantPrompt;
    useUI.setState({ assistantPrompt: undefined });
    void send(p, p);
  }, [open, assistantPrompt, send]);

  // Stop any live dictation on unmount.
  useEffect(
    () => () => {
      try {
        recogRef.current?.stop();
      } catch {
        /* already stopped */
      }
    },
    [],
  );

  const srSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const showMic = srSupported || mic.supported;
  const listening = srLive || mic.state === "live";

  const toggleListening = () => {
    if (listening) {
      try {
        recogRef.current?.stop();
      } catch {
        /* already stopped */
      }
      recogRef.current = null;
      setSrLive(false);
      mic.stop();
      return;
    }
    // Microphone stream feeds VoiceBeam; request it from the click gesture.
    void mic.start();
    if (!srSupported) return;
    const w = window as unknown as Record<string, new () => AnySpeechRecognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recog = new Ctor();
    recog.lang = SR_LANG[lang];
    recog.interimResults = true;
    recog.continuous = false;
    const base = input ? `${input} ` : "";
    recog.onresult = (ev: unknown) => {
      const e = ev as {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      };
      let text = "";
      for (const r of Array.from(e.results)) text += r[0]?.transcript ?? "";
      setInput(`${base}${text}`.slice(0, 500));
    };
    recog.onend = () => setSrLive(false);
    recog.onerror = () => setSrLive(false);
    recogRef.current = recog;
    try {
      recog.start();
      setSrLive(true);
    } catch {
      setSrLive(false);
    }
  };

  const submit = () => {
    void send(input);
  };

  const chips = (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={loading}
          onClick={() => void send(t(c), c)}
          className="min-h-10 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          {t(c)}
        </button>
      ))}
    </div>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) closeAssistant();
      }}
    >
      <SheetContent
        side="right"
        aria-label={t("Ask AI")}
        className="gap-0 border-l p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center gap-3 border-b border-border p-4 pr-12">
          <BotAvatar
            type="circle"
            face="mouth"
            state={loading ? "working" : "default"}
            interactive={false}
            size={44}
            aria-label={t("Audit Assistant")}
          />
          <div className="min-w-0 flex-1">
            <SheetTitle>{t("Ask AI")}</SheetTitle>
            <SheetDescription>
              {demoMode ? t("Demo mode · deterministic answers") : t("Live AI · grounded in audit data")}
            </SheetDescription>
          </div>
        </SheetHeader>

        <ChatContainerRoot className="min-h-0 flex-1">
          <ChatContainerContent className="gap-4 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  {t("Ask about risks, dues, delays, or any finding ID.")}
                </p>
                {chips}
              </div>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <BotAvatar
                    type="circle"
                    face="mouth"
                    state="default"
                    interactive={false}
                    size={32}
                    aria-label={t("Assistant answer")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl bg-muted px-3 py-2 text-sm">
                      <Markdown>{linkIds(m.text, useAudit.getState())}</Markdown>
                    </div>
                    {m.source === "ai" ? (
                      <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-violet-500" aria-hidden="true" />
                        {t("Live AI")}
                      </span>
                    ) : (
                      <span className="mt-1 inline-block text-xs text-muted-foreground">
                        {t("Demo answer")}
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
            {loading && (
              <div className="flex items-center gap-2">
                <ThinkingOrb state="working" size={20} aria-label={t(STATUS)} />
                <p className="text-sm text-muted-foreground">{t(STATUS)}</p>
              </div>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
        </ChatContainerRoot>

        <div className="border-t border-border p-3">
          {messages.length > 0 && <div className="mb-2">{chips}</div>}
          <VoiceBeam stream={mic.stream} processing={loading} theme={beamTheme} idle={0}>
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={submit}
              isLoading={loading}
              disabled={loading}
            >
              <PromptInputTextarea
                placeholder={t("Ask about risks, dues, delays…")}
                aria-label={t("Ask the audit assistant")}
              />
              <PromptInputActions className="justify-end">
                {showMic && (
                  <PromptInputAction tooltip={listening ? t("Stop listening") : t("Dictate")}>
                    <button
                      type="button"
                      onClick={toggleListening}
                      aria-pressed={listening}
                      aria-label={listening ? t("Stop listening") : t("Dictate by voice")}
                      className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Mic size={18} />
                    </button>
                  </PromptInputAction>
                )}
                <PromptInputAction tooltip={t("Send")}>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={loading || !input.trim()}
                    aria-label={t("Send question")}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                  >
                    <SendHorizontal size={18} />
                  </button>
                </PromptInputAction>
              </PromptInputActions>
            </PromptInput>
          </VoiceBeam>
          {mic.state === "denied" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Microphone is blocked — allow it in the browser to dictate.")}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
