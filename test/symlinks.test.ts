// No adapter follows a symbolic link at any component of a path, at scan time or later, when a folder is swapped
// for a link while the server runs (a branch switch can do that).
import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { adapter } from '../server/formats.ts'
import { readSafe, scanProject } from '../server/scan.ts'
import { scanOpenSpec } from '../server/openspec.ts'
import { scanKiro } from '../server/kiro.ts'
import { startServer } from '../server/server.ts'
import type { FormatId, Project } from '../server/types.ts'

const dirs: string[] = []
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-link-')); dirs.push(d); return d }
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
const write = (root: string, files: Record<string, string>) => {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text)
  }
  return root
}
const link = (target: string, at: string) => { fs.rmSync(at, { recursive: true, force: true }); fs.mkdirSync(path.dirname(at), { recursive: true }); fs.symlinkSync(target, at) }
// Every path a project lists, documents and units alike.
const paths = (p: Project) => [...(p.constitution ? [p.constitution] : []), ...(p.shared ?? []), ...p.features.flatMap((f) => f.docs)].map((d) => d.path)

// An outside folder holding a whole project of each format, every file marked "leak".
const outside = write(tmp(), {
  'changes/stolen/proposal.md': '# leak\n', 'changes/archive/2026-01-01-leaked/proposal.md': '# leak\n', 'archive/2026-01-02-leaked/proposal.md': '# leak\n',
  'specs/cap/spec.md': '# leak\n', 'cap/spec.md': '# leak\n', 'config.yaml': 'leak: 1\n',
  'specs-kiro/s/requirements.md': '# leak\n', 'steering/product.md': '# leak\n', 's/requirements.md': '# leak\n', 'product.md': '# leak\n',
  'memory/constitution.md': '# leak\n', '001-x/spec.md': '# leak\n',
})
const out = (rel: string) => path.join(outside, rel)

test('OpenSpec: a symlinked changes, archive, specs, capability or change folder, or project file, is never followed', () => {
  const base = { 'openspec/changes/real/proposal.md': '# ok\n' }
  const cases: [string, string][] = [
    ['openspec/changes', ''], ['openspec/changes/archive', 'archive'], ['openspec/specs', 'specs'], ['openspec/specs/cap', 'cap'],
    ['openspec/changes/linked', 'changes/stolen'], ['openspec/changes/archive/2026-01-03-linked', 'archive/2026-01-02-leaked'], ['openspec/config.yaml', 'config.yaml'],
  ]
  for (const [at, target] of cases) {
    const root = write(tmp(), at === 'openspec/changes' ? { 'openspec/specs/x/spec.md': '# ok\n' } : base)
    link(target ? out(target) : out('changes'), path.join(root, at))
    const p = scanOpenSpec(root, null)
    expect(paths(p).filter((x) => x.includes('leak') || fs.readFileSync(path.join(root, x), 'utf8').includes('leak')), at).toEqual([])
  }
})

test('Kiro: a symlinked specs or steering folder, spec folder or document is never followed', () => {
  const cases: [string, string][] = [['.kiro/specs', 'specs-kiro'], ['.kiro/steering', 'steering'], ['.kiro/specs/linked', 's'], ['.kiro/steering/product.md', 'product.md'], ['.kiro/specs/real/design.md', 'product.md']]
  for (const [at, target] of cases) {
    const root = write(tmp(), { '.kiro/specs/real/requirements.md': '# ok\n', '.kiro/steering/tech.md': '# ok\n' })
    link(out(target), path.join(root, at))
    expect(paths(scanKiro(root, null)).filter((x) => fs.readFileSync(path.join(root, x), 'utf8').includes('leak')), at).toEqual([])
  }
})

test('spec-kit: unchanged rules, still no symlink followed anywhere', () => {
  const root = write(tmp(), { 'specs/001-real/spec.md': '# ok\n' })
  link(out('001-x'), path.join(root, 'specs/002-linked'))
  link(out('001-x/spec.md'), path.join(root, 'specs/001-real/plan.md'))
  expect(paths(scanProject(root, null))).toEqual(['specs/001-real/spec.md'])
})

test('readSafe reads a real file and refuses a symlink at the file or at any folder above it', () => {
  const root = write(tmp(), { 'a/b/doc.md': 'ok' })
  expect(readSafe(root, 'a/b/doc.md').toString()).toBe('ok')
  link(out('product.md'), path.join(root, 'a/b/link.md'))
  expect(() => readSafe(root, 'a/b/link.md')).toThrow()
  link(path.join(root, 'a/b'), path.join(root, 'a/c'))
  expect(() => readSafe(root, 'a/c/doc.md')).toThrow(/symbolic link/)
  expect(() => readSafe(root, '../escape.md')).toThrow()
})

// Start a server on a real project, then swap one of its folders for a link to `outside`: nothing from there may show.
async function swapWhileRunning(format: FormatId, files: Record<string, string>, folder: string, target: string, leakPath: string) {
  const root = write(tmp(), files)
  const web = write(tmp(), { 'index.html': '<html></html>' })
  const srv = await startServer({ root, port: 0, webDir: web, adapter: adapter(format) })
  const get = (u: string) => fetch(`http://127.0.0.1:${srv.port}${u}`)
  try {
    const before = (await (await get('/api/project')).json()) as Project
    expect(paths(before).length, `${format}: the real project is read first`).toBeGreaterThan(0)
    fs.rmSync(path.join(root, folder), { recursive: true, force: true })
    fs.symlinkSync(out(target), path.join(root, folder))
    const after = (await (await get('/api/project')).json()) as Project
    expect(paths(after).filter((x) => x.startsWith(folder + '/')), `${format}: ${folder} swapped for a link`).toEqual([])
    expect((await get(`/api/doc?path=${encodeURIComponent(leakPath)}`)).status, leakPath).toBe(404)
  } finally {
    await srv.close()
  }
}

test('OpenSpec: openspec/ swapped for a symlink while the server runs shows and serves nothing from the link', async () => {
  const link = write(tmp(), { 'changes/stolen/proposal.md': '# leak\n', 'specs/cap/spec.md': '# leak\n', 'config.yaml': 'leak: 1\n' })
  const root = write(tmp(), { 'openspec/changes/real/proposal.md': '# ok\n', 'openspec/config.yaml': 'ok: 1\n' })
  const web = write(tmp(), { 'index.html': '<html></html>' })
  const srv = await startServer({ root, port: 0, webDir: web, adapter: adapter('openspec') })
  try {
    fs.rmSync(path.join(root, 'openspec'), { recursive: true, force: true })
    fs.symlinkSync(link, path.join(root, 'openspec'))
    const p = (await (await fetch(`http://127.0.0.1:${srv.port}/api/project`)).json()) as Project
    expect(paths(p)).toEqual([])
    for (const leak of ['openspec/changes/stolen/proposal.md', 'openspec/specs/cap/spec.md', 'openspec/config.yaml'])
      expect((await fetch(`http://127.0.0.1:${srv.port}/api/doc?path=${encodeURIComponent(leak)}`)).status, leak).toBe(404)
  } finally {
    await srv.close()
  }
})

test('OpenSpec: openspec/changes swapped for a symlink while the server runs', () =>
  swapWhileRunning('openspec', { 'openspec/changes/real/proposal.md': '# ok\n' }, 'openspec/changes', 'changes', 'openspec/changes/archive/2026-01-01-leaked/proposal.md'))

test('Kiro: .kiro/ and .kiro/specs swapped for symlinks while the server runs', async () => {
  const files = { '.kiro/specs/real/requirements.md': '# ok\n', '.kiro/steering/tech.md': '# ok\n' }
  const target = write(tmp(), { 'specs/s/requirements.md': '# leak\n', 'steering/product.md': '# leak\n' })
  const root = write(tmp(), files)
  const web = write(tmp(), { 'index.html': '<html></html>' })
  const srv = await startServer({ root, port: 0, webDir: web, adapter: adapter('kiro') })
  try {
    fs.rmSync(path.join(root, '.kiro'), { recursive: true, force: true })
    fs.symlinkSync(target, path.join(root, '.kiro'))
    expect(paths((await (await fetch(`http://127.0.0.1:${srv.port}/api/project`)).json()) as Project)).toEqual([])
    expect((await fetch(`http://127.0.0.1:${srv.port}/api/doc?path=${encodeURIComponent('.kiro/specs/s/requirements.md')}`)).status).toBe(404)
  } finally {
    await srv.close()
  }
  await swapWhileRunning('kiro', files, '.kiro/specs', 'specs-kiro', '.kiro/specs/s/requirements.md')
})

test('spec-kit: specs/ and .specify/ swapped for symlinks while the server runs', async () => {
  const files = { 'specs/001-real/spec.md': '# ok\n', '.specify/memory/constitution.md': '# ok\n' }
  await swapWhileRunning('spec-kit', { 'specs/001-real/spec.md': '# ok\n' }, 'specs', '', 'specs/001-x/spec.md')
  const root = write(tmp(), files)
  const web = write(tmp(), { 'index.html': '<html></html>' })
  const srv = await startServer({ root, port: 0, webDir: web, adapter: adapter('spec-kit') })
  try {
    fs.rmSync(path.join(root, '.specify'), { recursive: true, force: true })
    fs.symlinkSync(outside, path.join(root, '.specify'))
    const p = (await (await fetch(`http://127.0.0.1:${srv.port}/api/project`)).json()) as Project
    expect(p.constitution).toBeNull()
    expect((await fetch(`http://127.0.0.1:${srv.port}/api/doc?path=${encodeURIComponent('.specify/memory/constitution.md')}`)).status).toBe(404)
  } finally {
    await srv.close()
  }
})
