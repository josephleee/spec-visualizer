import { checkItems, parse, slice, splitAt, takeLabels } from './md.ts'
import type { Node, Sec } from './md.ts'
import type { Block, Scenario } from './types.ts'

export function rawBlock(src: string, sec: Sec): Block {
  return { kind: 'raw', heading: sec.heading, depth: sec.depth, markdown: slice(src, sec.nodes) }
}

type Story = Extract<Block, { kind: 'stories' }>['items'][number]

const STORY = /^User Story\s+\d+\s*[-–—:]\s*(.+?)(?:\s*\(Priority:\s*(\w+)\))?$/
const GWT = /^\*\*Given\*\*\s*([\s\S]*?)\s*,?\s*\*\*When\*\*\s*([\s\S]*?)\s*,?\s*\*\*Then\*\*\s*([\s\S]*)$/
const ID_ITEM = /^\*\*([A-Z]+-\d+)\*\*:\s*([\s\S]*)$/

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
  return items.length ? { kind: 'idList', heading: sec.heading ?? '', items, rest: rest.filter(Boolean).join('\n\n') } : null
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
      else { flush(); blocks.push(idList(src, sub) ?? rawBlock(src, sub)) }
    }
    flush()
  }
  return blocks
}

const isCheckList = (n: Node) => n.type === 'list' && n.children.some((i) => i.checked != null)
const at = (n: Node) => n.position!.start.offset!

function parseChecks(src: string): Block[] {
  const blocks: Block[] = []
  for (const sec of splitAt(parse(src), 2)) {
    if (sec.heading === null) continue
    const items = checkItems(sec.nodes)
    if (!items.length) { blocks.push(rawBlock(src, sec)); continue }
    const heads = sec.nodes.filter((n) => n.type === 'heading')
    const { fields, rest } = takeLabels(src, sec.nodes.filter((n) => n.type !== 'heading' && !isCheckList(n)))
    const left = [...rest, ...heads].sort((a, b) => at(a) - at(b)).map((n) => slice(src, [n]))
    blocks.push({ kind: 'phase', title: sec.heading, fields, items, rest: left.join('\n\n') })
  }
  return blocks
}

export const parseTasks = parseChecks
export const parseChecklist = parseChecks
