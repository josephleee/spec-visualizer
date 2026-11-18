import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { memo } from './cache.ts'
import { checkItems, clean, kids, parse, splitAt, stamp } from './md.ts'
import type { Node } from './md.ts'
import type { DocKind, DocRef, Feature, Project, Stage } from './types.ts'

const CONSTITUTION = '.specify/memory/constitution.md'
const ORDER: DocKind[] = ['spec', 'plan', 'research', 'data-model', 'quickstart', 'contract', 'tasks', 'checklist', 'other']
const NAMED: Record<string, DocKind> = {
  'spec.md': 'spec', 'plan.md': 'plan', 'tasks.md': 'tasks', 'research.md': 'research',
  'data-model.md': 'data-model', 'quickstart.md': 'quickstart',
}

// lstat that never throws; symlinks report isDirectory()/isFile() false.
export const lst = (p: string) => { try { return fs.lstatSync(p) } catch { return undefined } }
export const isDir = (p: string) => lst(p)?.isDirectory() ?? false
// Entries of a directory, or [] when it cannot be read.
export const entries = (dir: string) => { try { return fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] } }

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

export const hashOf = (buf: Buffer) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12)

// What the scan works out from one file's text, kept per path and content hash: files are still read and hashed
// on every scan, but only a changed one is parsed.
const kept = memo<unknown>(5000)
export const keep = <T>(root: string, rel: string, hash: string, make: () => T) => kept([root, rel, hash].join('\0'), make) as T

// Reads one document; a read failure becomes DocRef.error so the scan goes on.
export function readDoc(root: string, rel: string, kind: DocKind): { ref: DocRef; text: string } {
  try {
    const buf = fs.readFileSync(path.join(root, rel))
    const hash = hashOf(buf)
    return { ref: { path: rel, kind, hash }, text: buf.toString('utf8') }
  } catch (e) {
    return { ref: { path: rel, kind, hash: '', error: e instanceof Error ? e.message : String(e) }, text: '' }
  }
}

// Recursive, skips symlinks and dot-entries. Returns paths relative to `dir`, forward slashes.
export function walk(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const e of entries(dir)) {
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

  const count = (rel: string) => {
    const d = docs.find((x) => x.rel === rel)
    return d && keep(root, d.ref.path, d.ref.hash, () => {
      const text = clean(d.text)
      const items = rel === 'tasks.md' ? checkItems(parse(text)) : []
      return { done: items.filter((i) => i.done).length, total: items.length, questions: text.match(/NEEDS CLARIFICATION/g)?.length ?? 0 }
    })
  }
  const t = count('tasks.md')
  const tasks = t ? { done: t.done, total: t.total } : null
  const openQuestions = (count('spec.md')?.questions ?? 0) + (count('plan.md')?.questions ?? 0)
  return { id, stage: stageOf({ tasks, hasPlan: docs.some((d) => d.rel === 'plan.md') }), docs: docs.map((d) => d.ref), tasks, openQuestions }
}

// Text only: links keep their text, images and HTML vanish.
const plain = (n: Node): string =>
  n.type === 'text' || n.type === 'inlineCode' ? n.value : n.type === 'image' || n.type === 'html' ? '' : n.type === 'break' ? ' ' : kids(n).map(plain).join('')

// First README paragraph that has words (so badge and image lines are skipped), at most 300 characters.
const CAP = 64 * 1024
export function readAbout(root: string): string | null {
  // Dirent types come from lstat, so a symlinked README is not a file here.
  const name = entries(root).find((e) => e.isFile() && /^readme\.md$/i.test(e.name))?.name
  if (!name) return null
  try {
    // O_NOFOLLOW: a README swapped for a symlink after the listing is still not followed. 64 KB is enough for a first paragraph.
    const fd = fs.openSync(path.join(root, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const buf = Buffer.alloc(CAP + 1) // one byte more tells a cut file from one of exactly CAP bytes
    let len = 0
    try { len = fs.readSync(fd, buf, 0, buf.length, 0) } finally { fs.closeSync(fd) }
    let text = buf.toString('utf8', 0, Math.min(len, CAP)).replace(/\r\n?/g, '\n')
    if (len > CAP) text = text.slice(0, text.lastIndexOf('\n\n') + 1) // a cut file ends mid-block: drop that block
    return keep(root, name, hashOf(buf.subarray(0, len)), () => {
      for (const n of parse(clean(text))) {
        const chars = n.type === 'paragraph' ? [...plain(n).replace(/\s+/g, ' ').trim()] : [] // code points, so no split surrogate pair
        if (chars.length > 300) return [...chars.slice(0, 300).join('').replace(/\s+\S*$/, '')].slice(0, 299).join('') + '…'
        if (chars.length) return chars.join('')
      }
      return null
    })
  } catch { /* unreadable: no about */ }
  return null
}

const num = (id: string) => /^\d+/.exec(id)?.[0]

// Folders with a number prefix first, in number order; then the rest by name.
export function byNumber(a: string, b: string): number {
  const [x, y] = [num(a), num(b)]
  if (x !== undefined && y !== undefined && +x !== +y) return +x - +y
  if ((x === undefined) !== (y === undefined)) return x === undefined ? 1 : -1
  return a < b ? -1 : a > b ? 1 : 0
}

export function scanProject(root: string, branch: string | null = currentBranch(root)): Project {
  let constitution: DocRef | null = null
  let constitutionVersion: string | null = null
  let constitutionRatified: string | null = null
  let constitutionAmended: string | null = null
  let principles: string[] = []
  const cp = path.join(root, CONSTITUTION)
  // every component must be a real directory/file: a symlinked parent would escape the root
  if (isDir(path.join(root, '.specify')) && isDir(path.dirname(cp)) && lst(cp)?.isFile()) {
    const c = readDoc(root, CONSTITUTION, 'constitution')
    constitution = c.ref
    const read = keep(root, CONSTITUTION, c.ref.hash, () => {
      const src = clean(c.text)
      const nodes = parse(src)
      const st = stamp(src, nodes).fields // the same reading as the constitution page
      const label = (name: string) => st.find((f) => f.label === name)?.value || null
      const core = splitAt(nodes, 2).find((s) => /^Core Principles/i.test(s.heading ?? ''))
      // Only I/V/X numerals or digits are a numbering prefix: "C. Consistency" and "MIX. Odd" are titles.
      const titles = (core?.nodes ?? []).filter((n) => n.type === 'heading' && n.depth === 3)
        .map((n) => plain(n).replace(/\s+/g, ' ').trim().replace(/^(?:[IVX]+|\d+)[.)]\s+/, '')).filter(Boolean)
      return { version: label('Version'), ratified: label('Ratified'), amended: label('Last Amended'), titles }
    })
    constitutionVersion = read.version
    constitutionRatified = read.ratified
    constitutionAmended = read.amended
    principles = [...read.titles]
  }

  const specs = path.join(root, 'specs')
  const ids = isDir(specs)
    ? entries(specs).filter((e) => e.isDirectory()).map((e) => e.name)
    : []
  ids.sort(byNumber)
  const features = ids.map((id) => scanFeature(root, id))
  const currentFeature = features.find((f) => f.id === branch)?.id ?? null
  if (currentFeature) features.sort((a, b) => +(b.id === currentFeature) - +(a.id === currentFeature)) // stable
  return {
    root, name: path.basename(root), about: readAbout(root),
    constitution, constitutionVersion, constitutionRatified, constitutionAmended, principles, currentFeature, features,
  }
}
