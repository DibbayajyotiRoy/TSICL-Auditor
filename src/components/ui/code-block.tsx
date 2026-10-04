import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import type { Highlighter } from "shiki"

// Only these grammars ship in the bundle; anything else renders as plain
// text so opening a code block never pulls extra language downloads.
const LANGS = ["ts", "tsx", "js", "jsx", "json", "bash", "markdown", "plaintext"] as const
const ALIAS: Record<string, (typeof LANGS)[number]> = {
  typescript: "ts",
  javascript: "js",
  shell: "bash",
  sh: "bash",
  md: "markdown",
  txt: "plaintext",
  text: "plaintext",
}
const THEMES = ["github-light", "github-dark"] as const
const KNOWN_LANGS: readonly string[] = LANGS
const KNOWN_THEMES: readonly string[] = THEMES

function normalize(language: string): (typeof LANGS)[number] {
  const l = language.toLowerCase()
  return (KNOWN_LANGS.includes(l) ? l : ALIAS[l] ?? "plaintext") as (typeof LANGS)[number]
}

let cached: Promise<Highlighter> | undefined
function getHighlighter() {
  // Dynamic import keeps shiki out of the initial chunk; created once and reused.
  return (cached ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({ langs: [...LANGS], themes: [...THEMES] }),
  ))
}

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-card text-card-foreground rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-light",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    async function highlight() {
      if (!code) {
        if (live) setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      const lang = normalize(language)
      const resolved = KNOWN_THEMES.includes(theme) ? theme : "github-light"
      const html = await (await getHighlighter()).codeToHtml(code, { lang, theme: resolved })
      if (live) setHighlightedHtml(html)
    }
    highlight()
    return () => { live = false }
  }, [code, language, theme])

  const classNames = cn(
    "w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
