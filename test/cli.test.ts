import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CliError, opener, run, startOnFreePort } from '../server/main.ts'
import type { Block, ParsedDoc, Project } from '../server/types.ts'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-cli-'))
const webDir = tmp()
const project = tmp()
const plain = tmp()
fs.writeFileSync(path.join(webDir, 'index.html'), '<h1>hi</h1>')
fs.mkdirSync(path.join(project, 'specs/001-x'), { recursive: true })
fs.writeFileSync(path.join(project, 'specs/001-x/spec.md'), '# Spec\n')

const open: (() => Promise<void>)[] = []
afterAll(async () => {
  for (const close of open) await close()
  for (const d of [webDir, project, plain]) fs.rmSync(d, { recursive: true, force: true })
})

// Runs the CLI in-process on a free port; nothing is opened unless the test passes `open`.
async function cli(argv: string[], io: { open?: (url: string) => void; webDir?: string } = {}) {
  const lines: string[] = []
  const srv = await run(argv, { out: (l) => lines.push(l), webDir, ...io })
  if (srv) open.push(srv.close)
  return { lines, srv }
}

test('--version prints the package version and starts nothing', async () => {
  const { lines, srv } = await cli(['--version'])
  expect(lines).toEqual([JSON.parse(fs.readFileSync('package.json', 'utf8')).version])
  expect(srv).toBeUndefined()
})

test('--help lists every option and starts nothing', async () => {
  const { lines, srv } = await cli(['--help'])
  for (const opt of ['--port', '--demo', '--no-open', '--help', '--version']) expect(lines.join('\n')).toContain(opt)
  expect(srv).toBeUndefined()
})

test('an unknown option is an error that points to --help', async () => {
  await expect(cli(['--nope'])).rejects.toThrow(CliError)
  await expect(cli(['--nope'])).rejects.toThrow(/--help/)
})

test('a project path starts the server and prints the address in use', async () => {
  const { lines, srv } = await cli([project, '--port', '0'])
  expect(lines).toEqual(['spec-kit project: 1 features, 1 documents', `Dashboard: http://127.0.0.1:${srv!.port}`])
  expect((await fetch(`http://127.0.0.1:${srv!.port}/`)).status).toBe(200)
})

test('the existing messages: not a spec-kit folder, bad port, missing web files', async () => {
  await expect(cli([plain])).rejects.toThrow(`Not a spec-kit project: no specs/ or .specify/ folder in ${plain}`)
  await expect(cli([project, '--port', 'x'])).rejects.toThrow('Invalid port: x')
  await expect(cli([project, '--port', '0'], { webDir: plain })).rejects.toThrow('Web files are missing. Run: npm run build')
})

test('the browser opens on the printed address by default, and --no-open keeps it shut', async () => {
  const urls: string[] = []
  const a = await cli([project, '--port', '0'], { open: (u) => urls.push(u) })
  expect(urls).toEqual([`http://127.0.0.1:${a.srv!.port}`])
  await cli([project, '--port', '0', '--no-open'], { open: (u) => urls.push(u) })
  expect(urls).toHaveLength(1)
})

test('the opener is the platform command with the address as one argument, never a shell', () => {
  const url = 'http://127.0.0.1:4321'
  expect(opener('darwin', url)).toEqual(['open', [url]])
  expect(opener('linux', url)).toEqual(['xdg-open', [url]])
  expect(opener('win32', url)).toEqual(['rundll32', ['url.dll,FileProtocolHandler', url]])
})

test('an explicit --port that is busy fails with the hint', async () => {
  const { srv } = await cli([project, '--port', '0'])
  const p = srv!.port
  await expect(cli([project, '--port', String(p)])).rejects.toThrow(`Port ${p} is in use. Try: spec-visualizer --port ${p + 1}`)
})

test('without --port a busy port falls through to the next ones, then gives up', async () => {
  const { srv } = await cli([project, '--port', '0'])
  const busy = srv!.port
  const next = await startOnFreePort({ root: project, port: busy, webDir })
  open.push(next.close)
  expect(next.port).toBeGreaterThan(busy)
  expect(next.port).toBeLessThan(busy + 10)
  await expect(startOnFreePort({ root: project, port: busy, webDir }, 1)).rejects.toMatchObject({ code: 'EADDRINUSE' })
})

test('--demo takes no path', async () => {
  await expect(cli(['--demo', project])).rejects.toThrow(CliError)
})

test('--demo serves the bundled example: every stage, both story dialects, every document form', async () => {
  const { srv } = await cli(['--demo', '--port', '0'])
  const base = `http://127.0.0.1:${srv!.port}`
  const p = (await (await fetch(`${base}/api/project`)).json()) as Project
  expect(p.features.length).toBeGreaterThanOrEqual(6)
  expect(p.features.length).toBeLessThanOrEqual(8)
  expect(new Set(p.features.map((f) => f.stage))).toEqual(new Set(['specify', 'plan', 'tasks', 'implement', 'done']))
  expect(p.principles.length).toBeGreaterThanOrEqual(5)
  expect(p.principles.length).toBeLessThanOrEqual(7)
  expect(p.about).toBeTruthy()
  expect(p.constitutionVersion && p.constitutionRatified && p.constitutionAmended).toBeTruthy()
  expect(p.features.some((f) => f.openQuestions > 0)).toBe(true)

  const refs = [p.constitution!, ...p.features.flatMap((f) => f.docs)]
  expect(new Set(refs.map((r) => r.kind))).toEqual(
    new Set(['constitution', 'spec', 'plan', 'research', 'data-model', 'quickstart', 'contract', 'tasks', 'checklist', 'other']))
  const blocks: Block[] = []
  for (const r of refs) {
    expect(r.error).toBeUndefined()
    blocks.push(...((await (await fetch(`${base}/api/doc?path=${encodeURIComponent(r.path)}`)).json()) as ParsedDoc).blocks)
  }
  expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['raw', 'stories', 'idList', 'phase', 'fields', 'cards', 'decisions', 'code']))
  const stories = blocks.flatMap((b) => (b.kind === 'stories' ? b.items : []))
  expect(stories.some((s) => s.priority && s.why && s.test)).toBe(true) // template dialect
  expect(stories.some((s) => s.narrative && !s.priority)).toBe(true) // As a / I want / So that dialect
  for (const s of stories) expect(s.scenarios.length, s.title).toBeGreaterThan(0)
  const tasks = blocks.flatMap((b) => (b.kind === 'phase' ? b.items : []))
  expect(tasks.some((t) => t.parallel)).toBe(true)
  expect(tasks.some((t) => t.story)).toBe(true)
})

// ---------- other formats ----------

const folder = (files: Record<string, string>) => {
  const root = tmp()
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text)
  }
  return root
}
const os1 = folder({ 'openspec/specs/loans/spec.md': '# loans\n', 'openspec/changes/add-x/proposal.md': '## Why\n' })
const kiro1 = folder({ '.kiro/steering/product.md': '# P\n', '.kiro/specs/search/requirements.md': '# R\n', '.kiro/specs/search/tasks.md': '- [ ] 1. a\n' })
const mixed = folder({ 'specs/001-x/spec.md': '# S\n', 'openspec/changes/add-x/proposal.md': '## Why\n', '.kiro/specs/s/requirements.md': '# R\n' })
afterAll(() => { for (const d of [os1, kiro1, mixed]) fs.rmSync(d, { recursive: true, force: true }) })

test('an OpenSpec or a Kiro folder is found by its folders and named in the first line', async () => {
  const a = await cli([os1, '--port', '0'])
  expect(a.lines[0]).toBe('OpenSpec project: 1 changes, 2 documents')
  const p = await (await fetch(`http://127.0.0.1:${a.srv!.port}/api/project`)).json() as Project
  expect(p.format).toBe('openspec')
  const b = await cli([kiro1, '--port', '0'])
  expect(b.lines[0]).toBe('Kiro project: 1 specs, 3 documents')
  expect(b.lines).toHaveLength(2)
})

test('a folder of several formats shows spec-kit first and says how to choose another', async () => {
  const { lines } = await cli([mixed, '--port', '0'])
  expect(lines[0]).toBe('spec-kit project: 1 features, 1 documents')
  expect(lines[1]).toBe('Also found: OpenSpec (openspec/), Kiro (.kiro/specs/ or .kiro/steering/). Showing spec-kit; choose with --format openspec')
  const k = await cli([mixed, '--port', '0', '--format', 'kiro'])
  expect(k.lines[0]).toBe('Kiro project: 1 specs, 1 documents')
  expect(k.lines).toHaveLength(2) // the format was asked for: nothing else to say
})

test('--format must name a known format the folder has', async () => {
  await expect(cli([os1, '--format', 'bmad'])).rejects.toThrow('Unknown format: bmad. Use one of: spec-kit, openspec, kiro')
  await expect(cli([os1, '--format', 'kiro'])).rejects.toThrow(`Not a Kiro project: no .kiro/specs/ or .kiro/steering/ folder in ${os1}`)
  await expect(cli([kiro1, '--format', 'openspec'])).rejects.toThrow(`Not an OpenSpec project: no openspec/ folder in ${kiro1}`)
  await expect(cli([plain])).rejects.toThrow('Nor an OpenSpec project (no openspec/ folder) or a Kiro project (no .kiro/specs/ or .kiro/steering/ folder).')
})

test('--help names --format and the formats it reads', async () => {
  const { lines } = await cli(['--help'])
  expect(lines.join('\n')).toMatch(/--format <name>[\s\S]*spec-kit, openspec or kiro/)
})

test('the server tells the page its format before the first request returns', async () => {
  const { srv } = await cli([os1, '--port', '0'])
  expect(await (await fetch(`http://127.0.0.1:${srv!.port}/`)).text()).toBe('<h1>hi</h1>') // a page without <html> is served as it is
  const web = folder({ 'index.html': '<!doctype html>\n<html lang="en"><body></body></html>' })
  const a = await cli([os1, '--port', '0'], { webDir: web })
  expect(await (await fetch(`http://127.0.0.1:${a.srv!.port}/`)).text()).toBe('<!doctype html>\n<html data-format="openspec" lang="en"><body></body></html>')
  const b = await cli([project, '--port', '0'], { webDir: web })
  expect(await (await fetch(`http://127.0.0.1:${b.srv!.port}/`)).text()).toContain('<html data-format="spec-kit" lang="en">')
  fs.rmSync(web, { recursive: true, force: true })
})

for (const [format, unit, stages] of [
  ['openspec', 'changes', ['propose', 'design', 'tasks', 'apply', 'archive']],
  ['kiro', 'specs', ['requirements', 'design', 'tasks', 'implement', 'done']],
] as const) {
  test(`--demo --format ${format} serves its bundled example: units at every stage, every document parsed`, async () => {
    const { lines, srv } = await cli(['--demo', '--format', format, '--port', '0'])
    expect(lines[0]).toMatch(new RegExp(`^\\w+ project: \\d+ ${unit}, \\d+ documents$`))
    const base = `http://127.0.0.1:${srv!.port}`
    const p = (await (await fetch(`${base}/api/project`)).json()) as Project
    expect(p.format).toBe(format)
    expect(new Set(p.features.map((f) => f.stage))).toEqual(new Set(stages))
    expect(p.about).toBeTruthy()
    const blocks: Block[] = []
    for (const r of [...(p.shared ?? []), ...p.features.flatMap((f) => f.docs)]) {
      expect(r.error).toBeUndefined()
      const res = await fetch(`${base}/api/doc?path=${encodeURIComponent(r.path)}`)
      expect(res.status, r.path).toBe(200)
      blocks.push(...((await res.json()) as ParsedDoc).blocks)
    }
    expect(blocks.some((b) => b.kind === 'requirements')).toBe(true)
    expect(blocks.some((b) => b.kind === 'phase')).toBe(true)
    expect(blocks.some((b) => b.kind === 'cards')).toBe(true)
  })
}
