import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { CheckItem, Field } from './types.ts'

export type Node = import('mdast').RootContent
export type Sec = { heading: string | null; depth: number; nodes: Node[] }

const processor = unified().use(remarkParse).use(remarkGfm)

export const kids = (n: Node): Node[] => ('children' in n ? (n.children as Node[]) : [])
const start = (n: Node) => n.position!.start.offset!
const end = (n: Node) => n.position!.end.offset!

export function parse(src: string): Node[] {
  return processor.parse(src).children
}

// Cuts comment ranges found via the AST, so comments inside code blocks survive.
export function clean(src: string): string {
  let out = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const cuts: [number, number][] = []
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.type === 'html' && n.value.startsWith('<!--') && n.value.endsWith('-->')) cuts.push([start(n), end(n)])
      else walk(kids(n))
    }
  }
  walk(parse(out))
  for (const [s, e] of cuts.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + out.slice(e)
  return out
}

// Nodes may skip siblings (labels and breaks taken out): each run of neighbours is cut whole, runs are joined.
export function slice(src: string, nodes: Node[]): string {
  const runs: string[] = []
  let from = 0
  for (let i = 1; i <= nodes.length; i++) {
    if (i < nodes.length && !src.slice(end(nodes[i - 1]), start(nodes[i])).trim()) continue
    runs.push(src.slice(start(nodes[from]), end(nodes[i - 1])))
    from = i
  }
  return runs.join('\n\n').trim()
}

// Section heading nodes are not part of `nodes`; the heading text is in `heading`.
export function splitAt(nodes: Node[], depth: number): Sec[] {
  const secs: Sec[] = []
  let cur: Sec = { heading: null, depth: 0, nodes: [] }
  for (const n of nodes) {
    if (n.type === 'heading' && n.depth === depth) {
      if (cur.heading !== null || cur.nodes.length) secs.push(cur)
      cur = { heading: headingText(n), depth, nodes: [] }
    } else cur.nodes.push(n)
  }
  if (cur.heading !== null || cur.nodes.length) secs.push(cur)
  return secs
}

const inline = (n: Node): string => {
  switch (n.type) {
    case 'text': return n.value
    case 'inlineCode': return '`' + n.value + '`'
    case 'break': return ' '
    case 'strong': return '**' + kids(n).map(inline).join('') + '**'
    case 'emphasis': return '*' + kids(n).map(inline).join('') + '*'
    case 'delete': return '~~' + kids(n).map(inline).join('') + '~~'
    case 'image': return '![' + (n.alt ?? '') + '](' + n.url + ')'
    case 'link': return '[' + kids(n).map(inline).join('') + '](' + n.url + ')'
    default: return 'value' in n ? String(n.value) : kids(n).map(inline).join('')
  }
}

export function headingText(node: Node): string {
  return inline(node).trim()
}

const LABEL = /(?<=^|\n|\|[ \t]*)\*\*([^*\n]+)\*\*:/g

export function takeLabels(src: string, nodes: Node[]): { fields: Field[]; rest: Node[] } {
  const fields: Field[] = []
  let first = nodes.findIndex((n) => n.type === 'paragraph' && /^\*\*[^*\n]+\*\*:/.test(slice(src, [n])))
  if (first < 0) first = nodes.length
  let pending: string[] = [] // value pieces of the last field
  const flush = () => {
    if (fields.length) fields[fields.length - 1].value = pending.filter(Boolean).join('\n\n').trim()
    pending = []
  }
  const rest = nodes.slice(0, first)
  let open = true // false after a thematic break: what follows is no longer the label's value
  for (const n of nodes.slice(first)) {
    if (n.type === 'thematicBreak') { open = false; continue }
    const text = n.type === 'paragraph' ? slice(src, [n]) : ''
    const marks = [...text.matchAll(LABEL)]
    if (!marks.length || !text.startsWith(marks[0][0])) { if (open) pending.push(slice(src, [n])); else rest.push(n); continue }
    flush()
    open = true
    marks.forEach((m, i) => {
      if (i) flush()
      const from = m.index + m[0].length
      const to = i + 1 < marks.length ? marks[i + 1].index : text.length
      fields.push({ label: m[1].trim(), value: '' })
      pending = [text.slice(from, to).replace(/\s*\|\s*$/, '').trim()]
    })
  }
  flush()
  return { fields, rest }
}

export function checkItems(nodes: Node[]): CheckItem[] {
  const items: CheckItem[] = []
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.type === 'listItem' && n.checked != null) {
        let text = kids(n).filter((c) => c.type === 'paragraph').map(inline).join(' ').trim()
        const id = /^([A-Z]+\d+[a-z]?)(?:\s+|$)/.exec(text)
        if (id) text = text.slice(id[0].length)
        const parallel = /\[P\]/.test(text)
        const story = /\[(US\d+)\]/.exec(text)?.[1] ?? null
        text = text.replace(/\[P\]|\[US\d+\]/g, '').replace(/\s+/g, ' ').trim()
        items.push({ id: id?.[1] ?? null, done: n.checked, parallel, story, text })
      }
      walk(kids(n))
    }
  }
  walk(nodes)
  return items
}
