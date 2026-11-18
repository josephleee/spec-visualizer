// Kiro: .kiro/steering/*.md hold the project context; each spec is a folder .kiro/specs/<name>/ with requirements.md
// (or bugfix.md), design.md and tasks.md. cc-sdd writes the same folders.
import path from 'node:path'
import { clean, kids, parse, slice, splitAt } from './md.ts'
import type { Node } from './md.ts'
import { countTasks, parseDesign, parseNumberedTasks, wholeTasks, type Parser } from './items.ts'
import { byNumber, currentBranch, entries, isDir, keep, readAbout, readDoc, walk } from './scan.ts'
import type { Block, Criterion, DocKind, DocRef, Feature, Project, Requirement, Stage, Step } from './types.ts'

const ORDER: DocKind[] = ['requirements', 'design', 'tasks', 'other']
const NAMED: Record<string, DocKind> = { 'requirements.md': 'requirements', 'bugfix.md': 'requirements', 'design.md': 'design', 'tasks.md': 'tasks' }
const FOUNDATION = ['product.md', 'tech.md', 'structure.md']

export function isKiro(root: string): boolean {
  return isDir(path.join(root, '.kiro')) && (isDir(path.join(root, '.kiro', 'specs')) || isDir(path.join(root, '.kiro', 'steering')))
}

export const specKindOf = (rel: string): DocKind => NAMED[rel] ?? 'other'

export function specStageOf(f: { tasks: { done: number; total: number } | null; hasDesign: boolean }): Stage {
  const t = f.tasks
  if (t && t.total > 0 && t.done === t.total) return 'done'
  if (t && t.done > 0) return 'implement'
  if (t) return 'tasks'
  return f.hasDesign ? 'design' : 'requirements'
}

function scanSpec(root: string, id: string): Feature {
  const rel = `.kiro/specs/${id}`
  const docs: { ref: DocRef; text: string }[] = []
  for (const file of walk(path.join(root, rel))) {
    if (file.endsWith('.md')) docs.push(readDoc(root, `${rel}/${file}`, specKindOf(file)))
  }
  docs.sort((a, b) => ORDER.indexOf(a.ref.kind) - ORDER.indexOf(b.ref.kind) || (a.ref.path < b.ref.path ? -1 : 1))
  const t = docs.find((d) => d.ref.path === `${rel}/tasks.md`)
  const tasks = t ? keep(root, t.ref.path, t.ref.hash, () => countTasks(wholeTasks(parseNumberedTasks, clean(t.text)))) : null
  return { id, stage: specStageOf({ tasks, hasDesign: docs.some((d) => d.ref.kind === 'design') }), docs: docs.map((d) => d.ref), tasks, openQuestions: 0 }
}

export function scanKiro(root: string, branch: string | null = currentBranch(root)): Project {
  const steering = path.join(root, '.kiro', 'steering')
  const rank = (rel: string) => { const i = FOUNDATION.indexOf(rel); return i < 0 ? FOUNDATION.length : i }
  const shared = isDir(path.join(root, '.kiro')) && isDir(steering)
    ? walk(steering).filter((r) => r.endsWith('.md')).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))
      .map((r) => readDoc(root, `.kiro/steering/${r}`, 'context').ref)
    : []
  const specs = path.join(root, '.kiro', 'specs')
  const ids = isDir(path.join(root, '.kiro')) && isDir(specs)
    ? entries(specs).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort(byNumber)
    : []
  const features = ids.map((id) => scanSpec(root, id))
  const currentFeature = features.find((f) => f.id === branch)?.id ?? null
  if (currentFeature) features.sort((a, b) => +(b.id === currentFeature) - +(a.id === currentFeature)) // stable
  return {
    root, name: path.basename(root), about: readAbout(root),
    constitution: null, constitutionVersion: null, constitutionRatified: null, constitutionAmended: null, principles: [],
    currentFeature, features, format: 'kiro', shared,
  }
}

// ---------- requirements.md and bugfix.md ----------

const REQ = /^Requirement\s+(\d+[a-z]?(?:\.\d+)*)\s*(?:[:.\-–—]\s*(.*))?$/i
const STORY = /^\*\*(?:User Story|Objective)(?::\*\*|\*\*:)\s*/i
const CRITERIA = /^Acceptance Criteria$/i
const EARS = /^(?:\*\*)?(WHEN|IF|WHILE|WHERE)(?:\*\*)?\s+/
const ID = /^(\d+(?:\.\d+)+|\d+)\.?\s+(?=\S)/
const THEN = /,?\s*(?:\*\*)?\bTHEN\b(?:\*\*)?\s*/
const THE = /(?:,\s*|\s+)(?=(?:\*\*)?THE\s)/

// An EARS sentence as its condition and its response: `WHEN x THEN the system SHALL y`, `WHEN x, THE Parser SHALL y`,
// `IF …`, `WHILE …`, `WHERE …`. A sentence with no condition (`THE system SHALL y`) or none of these forms is one plain step.
export function ears(text: string): Step[] {
  const m = EARS.exec(text)
  if (!m) return [{ key: '', text }]
  const rest = text.slice(m[0].length)
  const then = THEN.exec(rest), the = THE.exec(rest)
  const cut = then && (!the || then.index <= the.index) ? then : the
  if (!cut) return [{ key: m[1], text: rest.trim() }]
  return [{ key: m[1], text: rest.slice(0, cut.index).trim() }, { key: 'THEN', text: rest.slice(cut.index + cut[0].length).trim() }]
}

// One criterion from an item's text: its own number (`1.1 WHEN …`) or the one given, and its EARS steps.
function criterion(text: string, id: string | null): Criterion {
  const own = ID.exec(text)
  return { id: own ? own[1] : id, name: null, steps: ears(own ? text.slice(own[0].length) : text) }
}
const isEars = (text: string) => EARS.test(text.replace(ID, ''))

// Criteria in `nodes`: every list item (numbered from the list's start, under the requirement's number), or, when
// `all` is false, only EARS paragraphs and items. What is not a criterion goes to `before` (above the first) or `after`.
function criteriaIn(src: string, nodes: Node[], req: string | null, all: boolean) {
  const criteria: Criterion[] = [], before: string[] = [], after: string[] = []
  const left = (text: string) => (criteria.length ? after : before).push(text)
  for (const n of nodes) {
    if (n.type === 'paragraph' && isEars(slice(src, [n]))) { criteria.push(criterion(slice(src, [n]), null)); continue }
    if (n.type !== 'list') { left(slice(src, [n])); continue }
    n.children.forEach((item, i) => {
      const text = slice(src, kids(item))
      if (!all && !isEars(text)) return left(slice(src, [item]))
      const no = n.ordered ? (n.start ?? 1) + i : null
      criteria.push(criterion(text, no === null ? null : req ? `${req}.${no}` : String(no)))
    })
  }
  return { criteria, before: before.join('\n\n'), after: after.join('\n\n') }
}

function requirement(src: string, id: string | null, title: string, nodes: Node[]): Requirement {
  const subs = splitAt(nodes, 4)
  const lead = subs[0]?.heading === null ? subs[0].nodes : []
  const storyNode = lead.find((n) => n.type === 'paragraph' && STORY.test(slice(src, [n])))
  const story = storyNode ? slice(src, [storyNode]).replace(STORY, '') : null
  const own = lead.filter((n) => n !== storyNode)
  const ac = subs.filter((s) => s.heading !== null && CRITERIA.test(s.heading))
  const others = subs.filter((s) => s.heading !== null && !CRITERIA.test(s.heading)).map((s) => `#### ${s.heading}${s.nodes.length ? `\n\n${slice(src, s.nodes)}` : ''}`)
  // Criteria under `#### Acceptance Criteria`; without that heading, EARS lines written straight under the requirement.
  if (!ac.length) {
    const c = criteriaIn(src, own, id, false)
    return { id, title, story, text: c.before, criteria: c.criteria, rest: [c.after, ...others].filter(Boolean).join('\n\n') }
  }
  const found = ac.map((s) => criteriaIn(src, s.nodes, id, true))
  const rest = [...found.flatMap((f) => [f.before, f.after]), ...others]
  return { id, title, story, text: slice(src, own), criteria: found.flatMap((f) => f.criteria), rest: rest.filter(Boolean).join('\n\n') }
}

// A ### is an item when it is `Requirement N` (feature specs) or holds EARS lines (a bugfix behaviour group, or the
// requirement groups the Kiro documentation shows). Sections without any stay as written.
export const parseKiroRequirements: Parser = (src: string): Block[] =>
  splitAt(parse(src), 2).filter((s) => s.heading !== null).flatMap((sec): Block[] => {
    const raw: Block = { kind: 'raw', heading: sec.heading, depth: 2, markdown: slice(src, sec.nodes) }
    const top = REQ.exec(sec.heading!)
    if (top) return [{ kind: 'requirements', heading: '', depth: 2, op: null, text: '', items: [requirement(src, top[1], top[2]?.trim() || sec.heading!, sec.nodes)], rest: '' }]
    const subs = splitAt(sec.nodes, 3)
    const items: Requirement[] = []
    const rest: string[] = []
    for (const s of subs) {
      if (s.heading === null) continue
      const m = REQ.exec(s.heading)
      if (m) { items.push(requirement(src, m[1], m[2]?.trim() || s.heading, s.nodes)); continue }
      const c = criteriaIn(src, s.nodes, null, false)
      if (c.criteria.length) items.push({ id: null, title: s.heading, story: null, text: c.before, criteria: c.criteria, rest: c.after })
      else rest.push(`### ${s.heading}${s.nodes.length ? `\n\n${slice(src, s.nodes)}` : ''}`)
    }
    const lead = subs[0]?.heading === null ? subs[0].nodes : []
    if (!items.length) {
      // EARS lines written straight under the ##, with no ###: the section itself is the one item.
      const c = criteriaIn(src, sec.nodes, null, false)
      if (!c.criteria.length) return [raw]
      return [{ kind: 'requirements', heading: sec.heading!, depth: 2, op: null, text: '', items: [{ id: null, title: sec.heading!, story: null, text: c.before, criteria: c.criteria, rest: c.after }], rest: '' }]
    }
    return [{ kind: 'requirements', heading: sec.heading!, depth: 2, op: null, text: slice(src, lead), items, rest: rest.join('\n\n') }]
  })

export const KIRO_PARSERS: Partial<Record<DocKind, Parser>> = {
  requirements: parseKiroRequirements, design: parseDesign, tasks: parseNumberedTasks,
}
