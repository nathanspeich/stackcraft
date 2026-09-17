import type { KeyboardEvent } from 'react'

/** Plain textarea editor: monospace, Tab inserts spaces, Enter keeps indentation. */
export default function CodeEditor({ value, onChange, label, rows, indent = 4 }: { value: string; onChange: (v: string) => void; label: string; rows?: number; indent?: number }) {
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = el.selectionStart
      const end = el.selectionEnd
      const pad = ' '.repeat(indent)
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        if (value.startsWith(pad, lineStart)) {
          onChange(value.slice(0, lineStart) + value.slice(lineStart + indent))
          requestAnimationFrame(() => el.setSelectionRange(Math.max(lineStart, start - indent), Math.max(lineStart, end - indent)))
        }
        return
      }
      onChange(value.slice(0, start) + pad + value.slice(end))
      requestAnimationFrame(() => el.setSelectionRange(start + indent, start + indent))
    } else if (e.key === 'Enter') {
      const start = el.selectionStart
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const line = value.slice(lineStart, start)
      const lead = line.match(/^\s*/)?.[0] ?? ''
      const extra = line.trimEnd().endsWith(':') ? ' '.repeat(indent) : ''
      e.preventDefault()
      const ins = '\n' + lead + extra
      onChange(value.slice(0, start) + ins + value.slice(el.selectionEnd))
      requestAnimationFrame(() => el.setSelectionRange(start + ins.length, start + ins.length))
    }
  }
  const lines = value.split('\n').length
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKey}
      rows={rows ?? Math.min(24, Math.max(8, lines + 1))}
      className="block w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-text outline-none"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      aria-label={label}
    />
  )
}
