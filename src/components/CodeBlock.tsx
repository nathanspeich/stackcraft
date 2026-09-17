import { useState } from 'react'
import { CopyIcon } from './icons'

const KEYWORDS: Record<string, string[]> = {
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'local'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'with', 'print', 'True', 'False', 'None', 'and', 'or', 'not', 'lambda', 'raise', 'pass', 'break', 'continue'],
  sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'JOIN', 'INNER', 'LEFT', 'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IN', 'BETWEEN', 'LIKE', 'PRIMARY', 'KEY', 'REFERENCES', 'INTEGER', 'TEXT', 'REAL', 'WITH', 'OVER', 'PARTITION', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  text: [],
}

/** Very small tokenizer for highlighting: strings, comments, numbers, keywords. */
function highlight(code: string, language: keyof typeof KEYWORDS) {
  const kw = new Set(KEYWORDS[language] ?? [])
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*$|--.*$)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/gm
  const out: { text: string; cls?: string }[] = []
  let last = 0
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) out.push({ text: code.slice(last, i) })
    const [full, str, com, num, word] = m
    if (str) out.push({ text: full, cls: 'text-linux' })
    else if (com && (language === 'sql' ? com.startsWith('--') : com.startsWith('#'))) out.push({ text: full, cls: 'text-muted italic' })
    else if (com) out.push({ text: full })
    else if (num) out.push({ text: full, cls: 'text-capstone' })
    else if (word && kw.has(language === 'sql' ? word.toUpperCase() : word)) out.push({ text: full, cls: 'text-python font-semibold' })
    else out.push({ text: full })
    last = i + full.length
  }
  if (last < code.length) out.push({ text: code.slice(last) })
  return out
}

export default function CodeBlock({ code, language = 'text', caption }: { code: string; language?: keyof typeof KEYWORDS; caption?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{caption ?? language}</span>
        <button type="button" onClick={copy} className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted hover:text-text" aria-label="Copy code">
          <CopyIcon />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>
          {highlight(code, language).map((t, i) => (
            <span key={i} className={t.cls}>{t.text}</span>
          ))}
        </code>
      </pre>
    </figure>
  )
}
