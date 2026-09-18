// Paste checkers for real-machine project steps. Pure functions, shared by the app and the tests.
import type { CheckResult, PasteChecker } from './types'

const nonEmptyLines = (text: string) => text.split('\n').filter((l) => l.trim() !== '')
const countMatches = (text: string, pattern: string, flags = '') => {
  const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  return (text.match(re) ?? []).length
}

/** Human description of one checker, used in failure messages. */
export function describeChecker(c: PasteChecker): string {
  switch (c.type) {
    case 'regex': return c.label ?? (c.count && c.count > 1 ? `text matching ${c.pattern} at least ${c.count} times` : `text matching ${c.pattern}`)
    case 'includes': return [c.text, ...(c.all ?? [])].map((t) => JSON.stringify(t)).join(' and ')
    case 'lines': return `at least ${c.atLeast} line${c.atLeast === 1 ? '' : 's'}`
    case 'words': return `at least ${c.atLeast} words`
    case 'not': return c.label ?? `no text matching ${c.pattern}`
    case 'any': return c.label ?? c.of.map(describeChecker).join(', or ')
  }
}

/** True when the pasted text satisfies one checker. */
export function passes(text: string, c: PasteChecker): boolean {
  switch (c.type) {
    case 'regex': return countMatches(text, c.pattern, c.flags) >= (c.count ?? 1)
    case 'includes': return [c.text, ...(c.all ?? [])].every((t) => text.includes(t))
    case 'lines': return nonEmptyLines(text).length >= c.atLeast
    case 'words': return text.trim().split(/\s+/).filter(Boolean).length >= c.atLeast
    case 'not': return !new RegExp(c.pattern, c.flags).test(text)
    case 'any': return c.of.some((k) => passes(text, k))
  }
}

/** Run every checker. The message names the first unmet one so the learner knows what is missing. */
export function checkPaste(text: string, checks: PasteChecker[]): CheckResult {
  if (!text.trim()) return { pass: false, message: 'Paste the output first.' }
  for (const c of checks) {
    if (!passes(text, c)) return { pass: false, message: `Not there yet. Looking for ${describeChecker(c)}.` }
  }
  return { pass: true, message: 'Verified.' }
}
