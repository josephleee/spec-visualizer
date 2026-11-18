import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ADAPTERS, adapter, detect } from '../server/formats.ts'

const dirs: string[] = []
const folder = (paths: string[]) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-detect-'))
  dirs.push(root)
  for (const p of paths) fs.mkdirSync(path.join(root, p), { recursive: true })
  return root
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
const ids = (root: string) => detect(root).map((a) => a.id)

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

test('several: spec-kit first, then OpenSpec, then Kiro, so a folder that opened as spec-kit still does', () => {
  expect(ids(folder(['specs', 'openspec', '.kiro/specs']))).toEqual(['spec-kit', 'openspec', 'kiro'])
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
