import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { CheckItem, Field } from './types.ts'

export type Node = import('mdast').RootContent
export type Sec = { heading: string | null; depth: number; nodes: Node[] }

const processor = unified().use(remarkParse).use(remarkGfm)

const kids = (n: Node): Node[] => ('children' in n ? (n.children as Node[]) : [])
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

export function slice(src: string, nodes: Node[]): string {
  return nodes.length ? src.slice(start(nodes[0]), end(nodes[nodes.length - 1])).trim() : ''
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
  for (const n of nodes.slice(first)) {
    const text = n.type === 'paragraph' ? slice(src, [n]) : ''
    const marks = [...text.matchAll(LABEL)]
    if (!marks.length || !text.startsWith(marks[0][0])) { pending.push(slice(src, [n])); continue }
    flush()
    marks.forEach((m, i) => {
      if (i) flush()
      const from = m.index + m[0].length
      const to = i + 1 < marks.length ? marks[i + 1].index : text.length
      fields.push({ label: m[1].trim(), value: '' })
      pending = [text.slice(from, to).replace(/\s*\|\s*$/, '').trim()]
    })
  }
  flush()
  return { fields, rest: nodes.slice(0, first) }
}

export function checkItems(nodes: Node[]): CheckItem[] {
  const items: CheckItem[] = []
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.type === 'listItem' && n.checked != null) {
        let text = kids(n).filter((c) => c.type === 'paragraph').map(inline).join(' ').trim()
        const id = /^([A-Z]+\d+)(?:\s+|$)/.exec(text)
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
