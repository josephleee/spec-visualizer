// Readers shared by the OpenSpec and Kiro adapters: task lists, design documents, YAML front matter.
// spec-kit documents never pass through here, so its output stays as it was.
import { headingText, kids, parse, slice, splitAt } from './md.ts'
import type { Node, Sec } from './md.ts'
import type { Block, CheckItem, Field } from './types.ts'

export type Parser = ((src: string, pre: Node[]) => Block[]) & { preamble?: true }

const raw = (src: string, sec: Sec): Block => ({ kind: 'raw', heading: sec.heading, depth: sec.depth, markdown: slice(src, sec.nodes) })

// A task line: GFM's `[ ]` / `[x]`, and the marks GFM does not read: any one character (`[~]`, `[-]`, OpenSpec counts
// them as open), padding (`[ x ]`), an empty box, and Kiro's optional `[ ]*`, also as `[ ]\*` once a formatter escaped
// it. Only x / X is done.
const MARK = /^\[\s*([^\]\s]?)\s*\](\\?\*?)(?![([])(?:[ \t]+|$)/
const NUMBER = /^(\d+[a-z]?(?:\.\d+[a-z]?)*)\.?(?=\s|$)\s*/
const PARALLEL = /^\((P)\)\s*|\[P\]\s*/

type Task = { item: CheckItem; depth: number }

// A nested node as written, its continuation lines moved back by the column it starts at, so it reads as top-level markdown.
function outdented(src: string, n: Node): string {
  const at = n.position!.start.offset!
  const col = at - (src.lastIndexOf('\n', at - 1) + 1)
  return slice(src, [n]).replace(new RegExp(`\n[ \t]{0,${col}}`, 'g'), '\n')
}

// Every task in `nodes`, in file order, with how deeply its list is nested. What a task holds besides its own line
// and its sub-tasks (detail bullets, code, `_Requirements: …_`) is kept as its notes; content that is not a task stays in `rest`.
export function tasksIn(src: string, nodes: Node[]): { tasks: Task[]; rest: Node[] } {
  const tasks: Task[] = []
  const rest: Node[] = []
  const hasTask = (n: Node): boolean => taskOf(n) !== null || kids(n).some(hasTask)
  function taskOf(n: Node): { done: boolean; optional: boolean; text: string } | null {
    if (n.type !== 'listItem') return null
    const first = n.children[0]
    const line = first?.type === 'paragraph' ? slice(src, [first]) : ''
    if (n.checked != null) {
      // remark moves the paragraph past the box only when the item opens with plain text; before bold, code or a link the box is still in the line.
      const at = first?.position?.start.offset ?? 0
      const moved = /\[[ \txX]\][ \t]*$/.test(src.slice(src.lastIndexOf('\n', at - 1) + 1, at))
      return { done: n.checked, optional: false, text: moved ? line : line.replace(/^\[[ \txX]\][ \t]*/, '') }
    }
    const m = MARK.exec(line)
    return m ? { done: /x/i.test(m[1]), optional: m[2].endsWith('*'), text: line.slice(m[0].length) } : null
  }
  function list(n: Node & { type: 'list' }, depth: number, notes: string[] | null) {
    for (const i of n.children) {
      const t = taskOf(i)
      if (!t) { // a plain item: a note of the task above it, or kept in place; tasks inside it are still read
        if (!hasTask(i)) { if (notes) notes.push(outdented(src, i)); else rest.push(i); continue }
        for (const c of i.children) {
          if (c.type === 'list' && hasTask(c)) list(c, depth + 1, notes)
          else if (notes) notes.push(outdented(src, c))
          else rest.push(c)
        }
        continue
      }
      let text = t.text.trim()
      const id = NUMBER.exec(text)
      if (id) text = text.slice(id[0].length)
      const par = PARALLEL.exec(text)
      if (par) text = text.replace(PARALLEL, '')
      const item: CheckItem = { id: id?.[1] ?? null, done: t.done, parallel: !!par, story: null, text: text.trim() }
      if (t.optional) item.optional = true
      tasks.push({ item, depth })
      const mine: string[] = []
      for (const c of i.children.slice(1)) {
        if (c.type === 'list' && hasTask(c)) list(c, depth + 1, mine)
        else mine.push(outdented(src, c))
      }
      if (mine.length) item.notes = mine.filter(Boolean).join('\n\n')
    }
  }
  for (const n of nodes) {
    if (n.type === 'list' && hasTask(n)) list(n, 0, null)
    else rest.push(n)
  }
  return { tasks, rest }
}

const titleOf = (src: string) => {
  const h1 = parse(src).find((n) => n.type === 'heading' && n.depth === 1)
  return h1 ? headingText(h1) : ''
}

// Sections with their preamble (the text before the first ##, without the title and header labels parseDoc took).
function sectionsWith(src: string, pre: Node[]): Sec[] {
  const secs = splitAt(parse(src), 2).filter((s) => s.heading !== null)
  return pre.length ? [{ heading: null, depth: 0, nodes: pre }, ...secs] : secs
}

// OpenSpec tasks.md: one phase per section that holds tasks (`## 1. Group`), every task counted, nested ones too.
export const parseGroupedTasks: Parser = Object.assign((src: string, pre: Node[]): Block[] =>
  sectionsWith(src, pre).map((sec) => {
    const { tasks, rest } = tasksIn(src, sec.nodes)
    if (!tasks.length) return raw(src, sec)
    return { kind: 'phase', title: sec.heading ?? titleOf(src), fields: [], items: tasks.map((t) => t.item), rest: slice(src, rest) } satisfies Block
  }), { preamble: true as const })

// Kiro tasks.md: the numbered top-level tasks are the phases and their sub-tasks the items, whether the sub-tasks are
// nested (Kiro) or written flat as `1.1` under `1.` (cc-sdd). A top-level task without sub-tasks is the one item of its
// phase; when no task of a section has sub-tasks, the section is one phase. A parent's own box is not counted.
export const parseNumberedTasks: Parser = Object.assign((src: string, pre: Node[]): Block[] =>
  sectionsWith(src, pre).flatMap((sec): Block[] => {
    const { tasks, rest } = tasksIn(src, sec.nodes)
    if (!tasks.length) return [raw(src, sec)]
    const groups: { head: Task; members: Task[] }[] = []
    for (const t of tasks) {
      const g = groups[groups.length - 1]
      // Nested under the group's own first task, or numbered under it (cc-sdd writes 1.1 flat under 1.). Compared with
      // the head itself, not the shallowest task of the section, so tasks nested under a plain bullet are not swallowed.
      const under = g && (t.depth > g.head.depth || (!!g.head.item.id && !!t.item.id?.startsWith(g.head.item.id + '.')))
      if (under) g.members.push(t)
      else groups.push({ head: t, members: [] })
    }
    const restText = slice(src, rest)
    if (!groups.some((g) => g.members.length))
      return [{ kind: 'phase', title: sec.heading ?? titleOf(src), fields: [], items: tasks.map((t) => t.item), rest: restText }]
    const out: Block[] = groups.map((g) => {
      const h = g.head.item
      const title = `${h.id ? `${h.id}. ` : ''}${h.text}`
      if (!g.members.length) return { kind: 'phase', title, fields: [], items: [h], rest: '' }
      // A parent whose sub-tasks are all optional is the work itself: it counts, and they are shown after it.
      if (!h.optional && g.members.every((m) => m.item.optional)) return { kind: 'phase', title, fields: [], items: [h, ...g.members.map((m) => m.item)], rest: '' }
      // The parent's notes (its detail bullets) stay with its phase; its own tick is shown by the tick of every member.
      return { kind: 'phase', title, fields: [], items: g.members.map((m) => m.item), rest: h.notes ?? '' }
    })
    // The section's own title and its text outside the task lists come first, as written above them.
    if (sec.heading !== null || restText) out.unshift({ kind: 'raw', heading: sec.heading, depth: sec.heading === null ? 0 : 2, markdown: restText })
    return out
  }), { preamble: true as const })

// A task document read the way parseDoc reads it, preamble included: what the scan counts from.
export const wholeTasks = (parser: Parser, text: string): Block[] => {
  const first = splitAt(parse(text), 2)[0]
  return parser(text, first?.heading === null ? first.nodes : [])
}

// Open or required tasks of a parsed task document: what the scan counts and the progress figures show.
export function countTasks(blocks: Block[]): { done: number; total: number } {
  const items = blocks.flatMap((b) => (b.kind === 'phase' ? b.items : [])).filter((i) => !i.optional)
  return { done: items.filter((i) => i.done).length, total: items.length }
}

const DECISIONS = /^(?:(?:key|architecture|architectural|design|technical)\s+)?decisions?\b|^correctness properties$/i

// design.md (OpenSpec and Kiro): every section as written, except that the ### of a decisions or correctness
// properties section become cards, one per decision or property.
export const parseDesign: Parser = (src: string): Block[] =>
  splitAt(parse(src), 2).filter((s) => s.heading !== null).flatMap((sec): Block[] => {
    const subs = splitAt(sec.nodes, 3)
    if (!DECISIONS.test(sec.heading!) || !subs.some((s) => s.heading !== null)) return [raw(src, sec)]
    const lead = subs[0].heading === null ? subs[0].nodes : []
    return [
      ...(slice(src, lead) ? [raw(src, { heading: sec.heading, depth: 2, nodes: lead })] : []),
      { kind: 'cards', heading: sec.heading!, items: subs.filter((s) => s.heading !== null).map((s) => ({ title: s.heading!, markdown: slice(src, s.nodes) })) },
    ]
  })

// YAML front matter (`---` … `---` on the first lines): `key: value` lines become header fields; anything else in it
// is kept as a yaml code block. The document is read on without it.
export function frontMatter(src: string): { body: string; fields: Field[]; leftover: Block | null } {
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src) // an opener with trailing spaces is still one
  if (!m) return { body: src, fields: [], leftover: null }
  const fields: Field[] = []
  const left: string[] = []
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z][\w-]*):[ \t]+(\S.*)$/.exec(line)
    // As code, so a glob like `**/*.tsx` is not read as emphasis; a value holding a backtick gets a longer fence.
    if (kv) fields.push({ label: kv[1], value: kv[2].includes('`') ? '`` ' + kv[2] + ' ``' : '`' + kv[2] + '`' })
    else if (line.trim()) left.push(line)
  }
  // The body keeps its line count, so offsets past the front matter are the same in both texts.
  return { body: '\n'.repeat(m[0].split('\n').length - 1) + src.slice(m[0].length), fields, leftover: left.length ? { kind: 'code', lang: 'yaml', text: left.join('\n') } : null }
}
