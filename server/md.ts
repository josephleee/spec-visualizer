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

const whole = (src: string): Node[] => processor.parse(src).children

const PIECE = 32 * 1024
const HEADING = /\n(?=#{1,6}[ \t])/g
const DEFINITION = /^ {0,3}\[[^\]\n]+\]:/m
const shift = (ns: Node[], by: number) => {
  for (const n of ns) { n.position!.start.offset! += by; n.position!.end.offset! += by; shift(kids(n), by) }
}

// The markdown parser gets slower than linear as a document grows (2 MB took over four seconds), so a long
// document is parsed in pieces cut at heading lines in column 0. A piece is parsed together with the heading line
// that follows it: if that line comes out as a heading starting at the cut, every block before it is closed and
// the cut is sound; if not (an open code fence or HTML block took the line), the piece grows to the next cut.
// Offsets are shifted back to the whole document; lines and columns are not, nothing here reads them.
// Reference definitions join distant parts of a document, so one with definitions is parsed whole.
// shortcut: a fence left open across many cuts is re-parsed once per cut, upgrade if such documents turn up.
function inPieces(src: string): Node[] {
  const out: Node[] = []
  let from = 0
  while (from < src.length) {
    let to = from
    let nodes: Node[]
    let sound = false
    do {
      HEADING.lastIndex = to + PIECE
      const m = HEADING.exec(src)
      to = m ? m.index + 1 : src.length
      const eol = src.indexOf('\n', to)
      nodes = whole(src.slice(from, to === src.length || eol < 0 ? src.length : eol))
      if (to === src.length) break
      const next = nodes.pop()
      sound = next?.type === 'heading' && start(next) === to - from
    } while (!sound)
    shift(nodes, from)
    out.push(...nodes)
    from = to
  }
  return out
}

let last: { src: string; nodes: Node[] } | undefined

// Callers only read the nodes: the latest result is kept, since a document is parsed more than once on its way through.
export function parse(src: string): Node[] {
  if (last?.src !== src) last = { src, nodes: src.length <= 2 * PIECE || DEFINITION.test(src) ? whole(src) : inPieces(src) }
  return last.nodes
}

// Cuts comment ranges found via the AST, so comments inside code blocks survive.
export function clean(src: string): string {
  const out = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (!out.includes('<!--')) return out
  const cuts: [number, number][] = []
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.type === 'html' && n.value.startsWith('<!--') && n.value.endsWith('-->')) cuts.push([start(n), end(n)])
      else walk(kids(n))
    }
  }
  walk(parse(out))
  const parts: string[] = []
  let pos = 0
  for (const [s, e] of cuts.sort((x, y) => x[0] - y[0])) { parts.push(out.slice(pos, s)); pos = e }
  return parts.join('') + out.slice(pos)
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

const STAMP = /(?:^|\|)[ \t]*\*\*(?:Version|Ratified|Last Amended)\*\*:/

// The constitution's `**Version**: x | **Ratified**: y | **Last Amended**: z` line, wherever it stands among `nodes`.
// A value is what follows its label up to the next `|` or the line end, so it never takes in a neighbour or the next block.
// The scanner and the parser both read the three values here.
export function stamp(src: string, nodes: Node[]): { fields: Field[]; rest: string; nodes: Node[] } {
  const fields: Field[] = []
  const rest: string[] = [] // what the stamp paragraphs hold besides labels
  const taken = nodes.filter((n) => n.type === 'paragraph' && slice(src, [n]).split('\n').some((l) => STAMP.test(l)))
  for (const n of taken) {
    const keep: string[] = []
    for (const line of slice(src, [n]).split('\n')) {
      if (!STAMP.test(line)) { keep.push(line); continue }
      const loose: string[] = []
      for (const part of line.split('|')) {
        const m = /^\s*\*\*([^*]+)\*\*:\s*(.*?)\s*$/.exec(part)
        if (m) fields.push({ label: m[1].trim(), value: m[2] })
        else if (part.trim()) loose.push(part.trim())
      }
      if (loose.length) keep.push(loose.join(' | '))
    }
    rest.push(keep.join('\n'))
  }
  return { fields, rest: rest.filter(Boolean).join('\n\n'), nodes: taken }
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
