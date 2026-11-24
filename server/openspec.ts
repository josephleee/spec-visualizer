// OpenSpec: openspec/specs/<capability>/spec.md is the source of truth; each change is a folder under openspec/changes/
// with proposal.md, delta specs, design.md and tasks.md, and moves to openspec/changes/archive/<date>-<name>/ when done.
import path from 'node:path'
import { clean, kids, parse, slice, splitAt } from './md.ts'
import type { Node } from './md.ts'
import { countTasks, parseDesign, parseGroupedTasks, wholeTasks, type Parser } from './items.ts'
import { currentBranch, entries, isDir, keep, readAbout, readDoc, realDir, realFile, walk } from './scan.ts'
import type { Block, Criterion, DocKind, DocRef, Feature, Project, Requirement, Stage, Step } from './types.ts'

const ORDER: DocKind[] = ['proposal', 'delta', 'design', 'tasks', 'other']
const NAMED: Record<string, DocKind> = { 'proposal.md': 'proposal', 'design.md': 'design', 'tasks.md': 'tasks' }

export function isOpenSpec(root: string): boolean {
  return isDir(path.join(root, 'openspec'))
}

// The kind of a file inside a change folder, by its path relative to that folder.
export function changeKindOf(rel: string): DocKind {
  if (/^specs\/(?:[^/]+\/)+spec\.md$/.test(rel)) return 'delta'
  return NAMED[rel] ?? 'other'
}

export function changeStageOf(f: { archived: boolean; tasks: { done: number; total: number } | null; hasDesign: boolean }): Stage {
  if (f.archived) return 'archive'
  if (f.tasks && f.tasks.done > 0) return 'apply'
  if (f.tasks) return 'tasks'
  return f.hasDesign ? 'design' : 'propose'
}

function scanChange(root: string, rel: string, archived: boolean): Feature {
  const docs: { ref: DocRef; text: string }[] = []
  for (const file of realDir(root, rel) ? walk(path.join(root, rel)) : []) {
    if (file.endsWith('.md')) docs.push(readDoc(root, `${rel}/${file}`, changeKindOf(file)))
  }
  docs.sort((a, b) => ORDER.indexOf(a.ref.kind) - ORDER.indexOf(b.ref.kind) || (a.ref.path < b.ref.path ? -1 : 1))
  const t = docs.find((d) => d.ref.path === `${rel}/tasks.md`)
  const tasks = t ? keep(root, t.ref.path, t.ref.hash, () => countTasks(wholeTasks(parseGroupedTasks, clean(t.text)))) : null
  return {
    id: rel.slice('openspec/changes/'.length),
    stage: changeStageOf({ archived, tasks, hasDesign: docs.some((d) => d.ref.kind === 'design') }),
    docs: docs.map((d) => d.ref), tasks, openQuestions: 0,
  }
}

const dirs = (dir: string) => entries(dir).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)

export function scanOpenSpec(root: string, branch: string | null = currentBranch(root)): Project {
  // Every folder is checked again on every scan, component by component: openspec/ or a folder in it may have been
  // swapped for a symbolic link since the server started, and nothing is read through one.
  const shared: DocRef[] = []
  if (realDir(root, 'openspec/specs')) {
    for (const rel of walk(path.join(root, 'openspec', 'specs')).filter((r) => r.endsWith('/spec.md')).sort()) shared.push(readDoc(root, `openspec/specs/${rel}`, 'capability').ref)
  }
  // Project context: config.yaml (1.x and later), project.md (0.x). Only real files, never a symlink.
  for (const name of ['config.yaml', 'project.md']) {
    if (realFile(root, `openspec/${name}`)) shared.push(readDoc(root, `openspec/${name}`, 'context').ref)
  }
  // Every other markdown file under openspec/ stays reachable as a project document: a capability's design.md (0.x),
  // notes beside the changes, folders of the project's own. Change folders list their own files; schemas/ holds templates.
  if (realDir(root, 'openspec')) {
    const inChange = (rel: string) => /^changes\/(?!archive\/)[^/]+\/./.test(rel) || /^changes\/archive\/[^/]+\/./.test(rel)
    const known = (rel: string) => /^specs\/(?:[^/]+\/)+spec\.md$/.test(rel) || rel === 'project.md' || rel.startsWith('schemas/') || inChange(rel)
    for (const rel of walk(path.join(root, 'openspec')).filter((r) => r.endsWith('.md') && !known(r)).sort()) shared.push(readDoc(root, `openspec/${rel}`, 'other').ref)
  }
  const active = realDir(root, 'openspec/changes') ? dirs(path.join(root, 'openspec', 'changes')).filter((n) => n !== 'archive').sort() : []
  const done = realDir(root, 'openspec/changes/archive') ? dirs(path.join(root, 'openspec', 'changes', 'archive')).sort().reverse() : [] // date-prefixed: newest first
  const features = [
    ...active.map((n) => scanChange(root, `openspec/changes/${n}`, false)),
    ...done.map((n) => scanChange(root, `openspec/changes/archive/${n}`, true)),
  ]
  const currentFeature = features.find((f) => f.id === branch)?.id ?? null
  if (currentFeature) features.sort((a, b) => +(b.id === currentFeature) - +(a.id === currentFeature)) // stable
  return {
    root, name: path.basename(root), about: readAbout(root),
    constitution: null, constitutionVersion: null, constitutionRatified: null, constitutionAmended: null, principles: [],
    currentFeature, features, format: 'openspec', shared,
  }
}

// ---------- spec.md, main and delta ----------

const OP = /^(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements$/i
const MAIN = /^Requirements$/i
const REQ = /^Requirement:\s*(.+?)$/i
const SCENARIO = /^Scenario:\s*(.*?)$/i
const STEP = /^(?:\*\*(GIVEN|WHEN|THEN|AND|BUT)\*\*:?|(GIVEN|WHEN|THEN|AND|BUT)\b:?)[ \t]*/i

const body = (src: string, item: Node) => slice(src, kids(item))
const headed = (depth: number, heading: string, text: string) => `${'#'.repeat(depth)} ${heading}${text ? `\n\n${text}` : ''}`

// The steps of a scenario in order: each list item with its keyword; anything else is a step without one.
export function stepsOf(src: string, nodes: Node[]): Step[] {
  const steps: Step[] = []
  for (const n of nodes) {
    if (n.type !== 'list') { steps.push({ key: '', text: slice(src, [n]) }); continue }
    for (const item of n.children) {
      const text = body(src, item)
      const m = STEP.exec(text)
      steps.push(m ? { key: (m[1] ?? m[2]).toUpperCase(), text: text.slice(m[0].length) } : { key: '', text })
    }
  }
  return steps
}

function requirement(src: string, title: string, nodes: Node[]): Requirement {
  const subs = splitAt(nodes, 4)
  const criteria: Criterion[] = []
  const rest: string[] = []
  for (const s of subs) {
    if (s.heading === null) continue
    const m = SCENARIO.exec(s.heading)
    if (m) criteria.push({ id: null, name: m[1] || null, steps: stepsOf(src, s.nodes) })
    else rest.push(headed(4, s.heading, slice(src, s.nodes)))
  }
  return { id: null, title, story: null, text: subs[0]?.heading === null ? slice(src, subs[0].nodes) : '', criteria, rest: rest.join('\n\n') }
}

// `## Requirements` (main spec) or `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` (delta): one requirements block,
// its `### Requirement:` sections as items. Other sections, and other ### inside these, are kept as written.
export const parseOpenSpecSpec: Parser = (src: string): Block[] =>
  splitAt(parse(src), 2).filter((s) => s.heading !== null).map((sec): Block => {
    const op = OP.exec(sec.heading!)?.[1].toUpperCase() ?? null
    const raw: Block = { kind: 'raw', heading: sec.heading, depth: 2, markdown: slice(src, sec.nodes) }
    if (!op && !MAIN.test(sec.heading!)) return raw
    const subs = splitAt(sec.nodes, 3)
    const items: Requirement[] = []
    const rest: string[] = []
    for (const s of subs) {
      if (s.heading === null) continue
      const m = REQ.exec(s.heading)
      if (m) items.push(requirement(src, m[1], s.nodes))
      else rest.push(headed(3, s.heading, slice(src, s.nodes)))
    }
    // RENAMED holds FROM/TO lines and no requirement headers: still the delta's section, its text kept as written.
    if (!items.length && op !== 'RENAMED') return raw
    return { kind: 'requirements', heading: sec.heading!, depth: 2, op, text: subs[0]?.heading === null ? slice(src, subs[0].nodes) : '', items, rest: rest.join('\n\n') }
  })

export const OPENSPEC_PARSERS: Partial<Record<DocKind, Parser>> = {
  capability: parseOpenSpecSpec, delta: parseOpenSpecSpec, design: parseDesign, tasks: parseGroupedTasks,
}
