import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ADAPTERS, adapter, detect } from '../server/formats.ts'

const dirs: string[] = []
// Folders end in '/', anything else is a file.
const folder = (paths: string[]) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-detect-'))
  dirs.push(root)
  for (const p of paths) {
    if (p.endsWith('/') || !/.\./.test(p.split('/').pop()!)) fs.mkdirSync(path.join(root, p), { recursive: true }) // a dot after the first character: a file
    else { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), 'x') }
  }
  return root
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
const ids = (root: string) => detect(root).map((f) => f.adapter.id)

test('each format by its own folders', () => {
  expect(ids(folder(['specs']))).toEqual(['spec-kit'])
  expect(ids(folder(['.specify']))).toEqual(['spec-kit'])
  expect(ids(folder(['openspec']))).toEqual(['openspec'])
  expect(ids(folder(['.kiro/specs']))).toEqual(['kiro'])
  expect(ids(folder(['.kiro/steering']))).toEqual(['kiro'])
})

test('none: an empty folder, a .kiro folder holding only settings, a file named like a folder', () => {
  expect(ids(folder([]))).toEqual([])
  expect(ids(folder(['.kiro/settings', '.kiro/hooks']))).toEqual([])
  const root = folder([])
  fs.writeFileSync(path.join(root, 'openspec'), '')
  fs.writeFileSync(path.join(root, 'specs'), '')
  expect(ids(root)).toEqual([])
})

test('several, with spec-kit documents: spec-kit first, then OpenSpec, then Kiro', () => {
  expect(ids(folder(['specs/001-x/spec.md', 'openspec', '.kiro/specs']))).toEqual(['spec-kit', 'openspec', 'kiro'])
  expect(ids(folder(['openspec', '.kiro/steering']))).toEqual(['openspec', 'kiro'])
  expect(ADAPTERS.map((a) => a.id)).toEqual(['spec-kit', 'openspec', 'kiro'])
})

test('a symlinked format folder is not followed into a match', () => {
  const real = folder(['openspec', '.kiro/specs', 'specs'])
  const root = folder([])
  for (const name of ['openspec', '.kiro', 'specs']) fs.symlinkSync(path.join(real, name), path.join(root, name))
  expect(ids(root)).toEqual([])
})

test('each adapter watches its own folders and reads its documents with its own parsers', () => {
  expect(adapter('spec-kit')).toMatchObject({ watch: ['specs', '.specify'] })
  expect(adapter('spec-kit').parsers).toBeUndefined() // spec-kit's own table, untouched
  expect(adapter('openspec')).toMatchObject({ watch: ['openspec'] })
  expect(adapter('kiro')).toMatchObject({ watch: ['.kiro'], frontMatter: true })
})

test('an OpenSpec project: live updates from openspec/, documents served only when the scan listed them', async () => {
  const { startServer } = await import('../server/server.ts')
  const root = folder(['openspec/changes/a'])
  fs.writeFileSync(path.join(root, 'openspec/changes/a/proposal.md'), '## Why\n')
  fs.writeFileSync(path.join(root, 'openspec/config.yaml'), 'schema: spec-driven\n')
  fs.writeFileSync(path.join(root, 'outside.md'), '# not listed\n')
  const web = folder([])
  fs.writeFileSync(path.join(web, 'index.html'), '<html></html>')
  const srv = await startServer({ root, port: 0, webDir: web })
  const base = `http://127.0.0.1:${srv.port}`
  try {
    await new Promise((r) => setTimeout(r, 300))
    const ac = new AbortController()
    let events = 0
    const res = await fetch(`${base}/api/events`, { signal: ac.signal })
    const reader = res.body!.getReader()
    void (async () => { try { for (;;) { const { done, value } = await reader.read(); if (done) return; events += new TextDecoder().decode(value).split('event: changed').length - 1 } } catch { /* closed */ } })()
    fs.writeFileSync(path.join(root, 'openspec/changes/a/tasks.md'), '- [ ] 1.1 a\n')
    await new Promise((r) => setTimeout(r, 600))
    expect(events).toBeGreaterThan(0)
    ac.abort()
    expect((await fetch(`${base}/api/doc?path=openspec%2Fconfig.yaml`)).status).toBe(200)
    expect((await fetch(`${base}/api/doc?path=outside.md`)).status).toBe(404)
    expect(await (await fetch(`${base}/`)).text()).toBe('<html data-format="openspec"></html>')
  } finally {
    await srv.close()
  }
})

// The review's counter-examples (I6): repositories with real OpenSpec or Kiro content and an unrelated specs/ folder.
test('a specs/ folder without spec-kit documents does not win against OpenSpec or Kiro content', () => {
  const cases: [string, string[], string][] = [
    ['loose files in specs/ beside OpenSpec', ['openspec/changes/', 'openspec/config.yaml', 'specs/REGISTRY_SPEC.md', 'specs/articles.zip'], 'openspec'],
    ['a model-checking folder in specs/ beside openspec/ notes', ['openspec/ROADMAP.md', 'specs/quint/fee_pool.qnt', 'specs/quint/README.md'], 'openspec'],
    ['Gherkin files in specs/ beside Kiro specs', ['.kiro/specs/dark-theme/requirements.md', 'specs/new_project.feature'], 'kiro'],
    ['a custom layout of dated folders in specs/', ['.kiro/specs/a/tasks.md', '.kiro/steering/product.md', 'specs/lookup_20260511100000/technical-design/x.md'], 'kiro'],
    ['Kiro-style folders mirrored in specs/', ['.kiro/specs/a/requirements.md', 'specs/action/requirements.md', 'specs/action/design.md', 'specs/action/tasks.md', 'specs/IDEAS.md'], 'kiro'],
  ]
  for (const [what, files, want] of cases) expect(ids(folder(files))[0], what).toBe(want)
})

test('genuinely mixed folders, with spec-kit documents, still open as spec-kit; a specs/ folder alone still does', () => {
  expect(ids(folder(['.specify/memory/constitution.md', 'specs/001-org/plan.md', 'openspec/specs/x/spec.md']))[0]).toBe('spec-kit')
  expect(ids(folder(['specs/006-android/spec.md', 'specs/006-android/tasks.md', 'openspec/changes/']))[0]).toBe('spec-kit')
  expect(ids(folder(['specs/notes.md']))).toEqual(['spec-kit']) // nothing else matched: as before
  expect(ids(folder(['specs/quint/x.qnt', 'openspec/']))).toEqual(['openspec', 'spec-kit']) // spec-kit stays a choice
})

test('each match says why it matched', () => {
  const why = (files: string[]) => detect(folder(files)).map((f) => `${f.adapter.id}: ${f.why}`)
  expect(why(['.specify/memory/', 'openspec/'])).toEqual(['spec-kit: .specify/', 'openspec: openspec/'])
  expect(why(['specs/001-x/plan.md'])).toEqual(['spec-kit: specs/001-x/plan.md'])
  expect(why(['specs/x.md', '.kiro/steering/'])).toEqual(['kiro: .kiro/steering/', 'spec-kit: specs/ (no spec-kit documents in it)'])
})
