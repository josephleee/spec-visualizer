import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { checkItems, clean, parse, takeLabels } from './md.ts'
import type { DocKind, DocRef, Feature, Project, Stage } from './types.ts'

const CONSTITUTION = '.specify/memory/constitution.md'
const ORDER: DocKind[] = ['spec', 'plan', 'research', 'data-model', 'quickstart', 'contract', 'tasks', 'checklist', 'other']
const NAMED: Record<string, DocKind> = {
  'spec.md': 'spec', 'plan.md': 'plan', 'tasks.md': 'tasks', 'research.md': 'research',
  'data-model.md': 'data-model', 'quickstart.md': 'quickstart',
}

const isDir = (p: string) => fs.lstatSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false

export function isSpecKit(root: string): boolean {
  return isDir(path.join(root, 'specs')) || isDir(path.join(root, '.specify'))
}

export function kindOf(rel: string): DocKind {
  if (rel.startsWith('contracts/')) return 'contract'
  if (/^checklists\/[^/]+\.md$/.test(rel)) return 'checklist'
  return NAMED[rel] ?? 'other'
}

export function stageOf(f: { tasks: { done: number; total: number } | null; hasPlan: boolean }): Stage {
  const t = f.tasks
  if (t && t.total > 0 && t.done === t.total) return 'done'
  if (t && t.done > 0) return 'implement'
  if (t) return 'tasks'
  return f.hasPlan ? 'plan' : 'specify'
}

export function currentBranch(root: string): string | null {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

// Reads one document; a read failure becomes DocRef.error so the scan goes on.
function readDoc(root: string, rel: string, kind: DocKind): { ref: DocRef; text: string } {
  try {
    const buf = fs.readFileSync(path.join(root, rel))
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)
    return { ref: { path: rel, kind, hash }, text: buf.toString('utf8') }
  } catch (e) {
    return { ref: { path: rel, kind, hash: '', error: e instanceof Error ? e.message : String(e) }, text: '' }
  }
}

// Recursive, skips symlinks and dot-entries. Returns paths relative to `dir`, forward slashes.
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink() || e.name.startsWith('.')) continue
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), prefix + e.name + '/'))
    else if (e.isFile()) out.push(prefix + e.name)
  }
  return out
}

function scanFeature(root: string, id: string): Feature {
  const dir = path.join(root, 'specs', id)
  const docs: { ref: DocRef; text: string; rel: string }[] = []
  for (const rel of walk(dir)) {
    if (!rel.endsWith('.md') && !rel.startsWith('contracts/')) continue
    docs.push({ ...readDoc(root, `specs/${id}/${rel}`, kindOf(rel)), rel })
  }
  docs.sort((a, b) => ORDER.indexOf(a.ref.kind) - ORDER.indexOf(b.ref.kind) || (a.ref.path < b.ref.path ? -1 : 1))

  const text = (rel: string) => clean(docs.find((d) => d.rel === rel)?.text ?? '')
  const hasTasks = docs.some((d) => d.rel === 'tasks.md')
  const items = checkItems(parse(text('tasks.md')))
  const tasks = hasTasks ? { done: items.filter((i) => i.done).length, total: items.length } : null
  const openQuestions = ['spec.md', 'plan.md'].reduce((n, r) => n + (text(r).match(/NEEDS CLARIFICATION/g)?.length ?? 0), 0)
  return { id, stage: stageOf({ tasks, hasPlan: docs.some((d) => d.rel === 'plan.md') }), docs: docs.map((d) => d.ref), tasks, openQuestions }
}

const num = (id: string) => /^\d+/.exec(id)?.[0]

export function scanProject(root: string, branch: string | null = currentBranch(root)): Project {
  let constitution: DocRef | null = null
  let constitutionVersion: string | null = null
  const cp = path.join(root, CONSTITUTION)
  if (fs.lstatSync(cp, { throwIfNoEntry: false })?.isFile()) {
    const c = readDoc(root, CONSTITUTION, 'constitution')
    constitution = c.ref
    const src = clean(c.text)
    constitutionVersion = takeLabels(src, parse(src)).fields.find((f) => f.label === 'Version')?.value ?? null
  }

  const specs = path.join(root, 'specs')
  const ids = isDir(specs)
    ? fs.readdirSync(specs, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : []
  ids.sort((a, b) => {
    const [x, y] = [num(a), num(b)]
    if (x !== undefined && y !== undefined && +x !== +y) return +x - +y
    if ((x === undefined) !== (y === undefined)) return x === undefined ? 1 : -1
    return a < b ? -1 : a > b ? 1 : 0
  })
  const features = ids.map((id) => scanFeature(root, id))
  const currentFeature = features.find((f) => f.id === branch)?.id ?? null
  if (currentFeature) features.sort((a, b) => +(b.id === currentFeature) - +(a.id === currentFeature)) // stable
  return { root, name: path.basename(root), constitution, constitutionVersion, currentFeature, features }
}
