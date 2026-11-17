import { checkItems, clean, headingText, parse, slice, splitAt, takeLabels } from './md.ts'
import type { Node, Sec } from './md.ts'
import type { Block, DocRef, Field, ParsedDoc, Scenario } from './types.ts'

export function rawBlock(src: string, sec: Sec): Block {
  return { kind: 'raw', heading: sec.heading, depth: sec.depth, markdown: slice(src, sec.nodes) }
}

type Story = Extract<Block, { kind: 'stories' }>['items'][number]

const STORY = /^User Story\s+\d+\s*[-–—:]\s*(.+?)(?:\s*\(Priority:\s*(\w+)\))?$/
const GWT = /^\*\*Given\*\*\s*([\s\S]*?)\s*,?\s*\*\*When\*\*\s*([\s\S]*?)\s*,?\s*\*\*Then\*\*\s*([\s\S]*)$/
const ID_ITEM = /^\*\*([A-Z]+-\d+[a-z]?)\*\*:\s*([\s\S]*)$/

const kids = (n: Node): Node[] => ('children' in n ? (n.children as Node[]) : [])
const body = (src: string, item: Node) => slice(src, kids(item))

function story(src: string, sec: Sec, m: RegExpExecArray): Story {
  const { fields, rest } = takeLabels(src, sec.nodes)
  const out: Story = { title: m[1], priority: m[2] ?? null, why: null, test: null, scenarios: [], rest: '' }
  const extra: string[] = [slice(src, rest)]
  const known = { 'Why this priority': 'why', 'Independent Test': 'test' } as const
  let sawScenarios = false
  for (const f of fields) {
    const key = known[f.label as keyof typeof known]
    if (key && out[key] === null) out[key] = f.value
    else if (f.label === 'Acceptance Scenarios' && !sawScenarios) {
      sawScenarios = true
      for (const n of parse(f.value)) {
        if (n.type !== 'list') { extra.push(slice(f.value, [n])); continue }
        for (const item of n.children) {
          const g = GWT.exec(body(f.value, item))
          if (g) out.scenarios.push({ given: g[1], when: g[2], then: g[3] } satisfies Scenario)
          else extra.push(slice(f.value, [item]))
        }
      }
    } else extra.push(`**${f.label}**: ${f.value}`)
  }
  out.rest = extra.filter(Boolean).join('\n\n')
  return out
}

function idList(src: string, sec: Sec): Block | null {
  const items: { id: string; text: string }[] = []
  const rest: string[] = []
  for (const n of sec.nodes) {
    if (n.type !== 'list') { rest.push(slice(src, [n])); continue }
    for (const item of n.children) {
      const m = ID_ITEM.exec(body(src, item))
      if (m) items.push({ id: m[1], text: m[2] })
      else rest.push(slice(src, [item]))
    }
  }
  return items.length ? { kind: 'idList', heading: sec.heading ?? '', depth: sec.depth, items, rest: rest.filter(Boolean).join('\n\n') } : null
}

// A ### with #### groups: the ### part first (text before the first ####), then one block per group, in file order.
function grouped(src: string, sec: Sec): Block[] {
  const groups = splitAt(sec.nodes, 4)
  if (!groups.some((g) => g.heading !== null)) return [idList(src, sec) ?? rawBlock(src, sec)]
  const lead: Sec = { heading: sec.heading, depth: sec.depth, nodes: groups[0].heading === null ? groups[0].nodes : [] }
  return [lead, ...groups.filter((g) => g.heading !== null)].map((g) => idList(src, g) ?? rawBlock(src, g))
}

export function parseSpec(src: string): Block[] {
  const blocks: Block[] = []
  for (const sec of splitAt(parse(src), 2)) {
    if (sec.heading === null) continue // title and preamble before the first ##
    const subs = splitAt(sec.nodes, 3)
    if (!subs.length) { blocks.push(rawBlock(src, sec)); continue }
    // The ## heading always survives; text before the first ### is its markdown.
    blocks.push(rawBlock(src, { heading: sec.heading, depth: 2, nodes: subs[0].heading === null ? subs[0].nodes : [] }))
    let stories: Story[] = []
    const flush = () => { if (stories.length) blocks.push({ kind: 'stories', items: stories }); stories = [] }
    for (const sub of subs) {
      const m = sub.heading === null ? null : STORY.exec(sub.heading)
      if (sub.heading === null) continue
      else if (m) stories.push(story(src, sub, m))
      else { flush(); blocks.push(...grouped(src, sub)) }
    }
    flush()
  }
  return blocks
}

const hasCheck = (n: Node): boolean => (n.type === 'listItem' && n.checked != null) || ('children' in n && (n.children as Node[]).some(hasCheck))
const at = (n: Node) => n.position!.start.offset!

function parseChecks(src: string): Block[] {
  const blocks: Block[] = []
  for (const sec of splitAt(parse(src), 2)) {
    if (sec.heading === null) continue
    const items = checkItems(sec.nodes)
    if (!items.length) { blocks.push(rawBlock(src, sec)); continue }
    // A heading ends the current label's value, so labels are read per segment.
    const left: { pos: number; text: string }[] = []
    const fields: Field[] = []
    let seg: Node[] = []
    const flush = () => {
      const t = takeLabels(src, seg)
      fields.push(...t.fields)
      for (const n of t.rest) left.push({ pos: at(n), text: slice(src, [n]) })
      seg = []
    }
    // Checkbox items go to `items`; everything else under a checkbox list stays visible in `rest`.
    const keep = (n: Node) => left.push({ pos: at(n), text: slice(src, [n]) })
    const takeList = (list: Node & { type: 'list' }) => {
      for (const i of list.children) {
        const sub = i.children.filter((c) => c.type !== 'paragraph')
        if (i.checked == null && !hasCheck(i)) { keep(i); continue }
        if (i.checked == null) keep(i.children[0]) // plain item holding checkboxes: keep its own text
        for (const c of sub) c.type === 'list' && hasCheck(c) ? takeList(c) : keep(c)
      }
    }
    for (const n of sec.nodes) {
      if (n.type === 'heading') { flush(); left.push({ pos: at(n), text: slice(src, [n]) }) }
      else if (n.type === 'list' && hasCheck(n)) takeList(n)
      else seg.push(n)
    }
    flush()
    left.sort((x, y) => x.pos - y.pos)
    blocks.push({ kind: 'phase', title: sec.heading, fields, items, rest: left.map((l) => l.text).filter(Boolean).join('\n\n') })
  }
  return blocks
}

export const parseTasks = parseChecks
export const parseChecklist = parseChecks

const sections = (src: string) => splitAt(parse(src), 2).filter((s) => s.heading !== null)

// Run `special` on sections it claims; every other section is raw.
function bySection(src: string, special: (sec: Sec) => Block[] | null): Block[] {
  return sections(src).flatMap((sec) => special(sec) ?? [rawBlock(src, sec)])
}

// One card per ###. Text between the ## and the first ### is kept as a raw block with the ## title.
function cardsOf(src: string, sec: Sec): Block[] | null {
  const subs = splitAt(sec.nodes, 3)
  const cards = subs.filter((s) => s.heading !== null)
  if (!cards.length) return null
  const out: Block[] = []
  if (subs[0].heading === null && slice(src, subs[0].nodes)) out.push(rawBlock(src, { heading: sec.heading, depth: 2, nodes: subs[0].nodes }))
  out.push({ kind: 'cards', heading: sec.heading!, items: cards.map((c) => ({ title: c.heading!, markdown: slice(src, c.nodes) })) })
  return out
}

// shortcut: a section with no labels stays raw instead of an empty fields block.
function fieldsOf(src: string, sec: Sec): Block[] | null {
  const { fields, rest } = takeLabels(src, sec.nodes)
  return fields.length ? [{ kind: 'fields', heading: sec.heading!, items: fields, rest: slice(src, rest) }] : null
}

export const parsePlan = (src: string): Block[] =>
  bySection(src, (sec) => (sec.heading === 'Technical Context' ? fieldsOf(src, sec) : null))

export const parseConstitution = (src: string): Block[] =>
  bySection(src, (sec) => (/^Core Principles/i.test(sec.heading!) ? cardsOf(src, sec) : fieldsOf(src, sec)))

export const parseDataModel = (src: string): Block[] =>
  bySection(src, (sec) => (/^entities/i.test(sec.heading!) ? cardsOf(src, sec) : null))

type Decision = Extract<Block, { kind: 'decisions' }>['items'][number]

export function parseResearch(src: string): Block[] {
  const out: Block[] = []
  let items: Decision[] = []
  const flush = () => { if (items.length) out.push({ kind: 'decisions', items }); items = [] }
  const decision = (title: string, nodes: Node[]) => {
    const { fields, rest } = takeLabels(src, nodes)
    if (!fields.some((f) => f.label.toLowerCase() === 'decision')) return false
    items.push({ title, fields, rest: slice(src, rest) })
    return true
  }
  for (const sec of sections(src)) {
    const subs = splitAt(sec.nodes, 3)
    if (!subs.some((s) => s.heading !== null)) { // a topic written directly under ##
      if (!decision(sec.heading!, sec.nodes)) { flush(); out.push(rawBlock(src, sec)) }
      continue
    }
    // `decisions` has no heading, so the ## title gets its own block.
    flush()
    out.push(rawBlock(src, { heading: sec.heading, depth: 2, nodes: subs[0].heading === null ? subs[0].nodes : [] }))
    for (const sub of subs) {
      if (sub.heading === null) continue
      if (!decision(sub.heading, sub.nodes)) { flush(); out.push(rawBlock(src, sub)) }
    }
    flush()
  }
  flush()
  return out
}

const PARSERS: Partial<Record<DocRef['kind'], (src: string) => Block[]>> = {
  spec: parseSpec, plan: parsePlan, tasks: parseTasks, checklist: parseChecklist,
  constitution: parseConstitution, research: parseResearch, 'data-model': parseDataModel,
}

export function parseDoc(ref: DocRef, src: string): ParsedDoc {
  if (ref.kind === 'contract' && !ref.path.endsWith('.md')) {
    return { ref, title: null, meta: [], blocks: [{ kind: 'code', lang: ref.path.split('.').pop() ?? '', text: src }] }
  }
  const text = clean(src)
  const nodes = parse(text)
  const h1 = nodes.find((n) => n.type === 'heading' && n.depth === 1)
  const pre = splitAt(nodes, 2).find((s) => s.heading === null)?.nodes.filter((n) => n !== h1) ?? []
  const { fields: meta, rest } = takeLabels(text, pre)
  const blocks: Block[] = []
  if (slice(text, rest)) blocks.push(rawBlock(text, { heading: null, depth: 0, nodes: rest }))
  try {
    blocks.push(...(PARSERS[ref.kind] ?? ((t) => bySection(t, () => null)))(text))
  } catch {
    blocks.length = 0
    blocks.push({ kind: 'raw', heading: null, depth: 0, markdown: text })
  }
  return { ref, title: h1 ? headingText(h1) : null, meta, blocks }
}
