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
