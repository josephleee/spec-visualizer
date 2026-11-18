import { afterAll, expect, test, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Counts the parsing work while leaving it real.
vi.mock('../server/md.ts', async (original) => {
  const m = await original<typeof import('../server/md.ts')>()
  return { ...m, parse: vi.fn(m.parse), clean: vi.fn(m.clean) }
})
vi.mock('../server/parsers.ts', async (original) => {
  const m = await original<typeof import('../server/parsers.ts')>()
  return { ...m, parseDoc: vi.fn(m.parseDoc) }
})

import { memo } from '../server/cache.ts'
import { clean, parse } from '../server/md.ts'
import { parseDoc } from '../server/parsers.ts'
import { scanProject } from '../server/scan.ts'
import { startServer } from '../server/server.ts'

const dirs: string[] = []
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-cache-')); dirs.push(d); return d }
const write = (root: string, rel: string, text: string) => {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })
const work = () => vi.mocked(parse).mock.calls.length + vi.mocked(clean).mock.calls.length

test('memo: a hit does not run the maker; the least recently used entries leave when the weight limit is passed', () => {
  const m = memo<string>(10, (v) => v.length)
  const make = vi.fn((v: string) => v)
  const get = (k: string, v: string) => m(k, () => make(v))
  expect([get('a', 'aaaa'), get('a', 'other')]).toEqual(['aaaa', 'aaaa'])
  expect(make).toHaveBeenCalledTimes(1)
  get('b', 'bbbb'); get('a', ''); get('c', 'cccc') // 12 > 10: b, the one not used for longest, leaves
  make.mockClear()
  get('a', ''); get('c', '')
  expect(make).not.toHaveBeenCalled()
  get('b', 'bbbb')
  expect(make).toHaveBeenCalledTimes(1)
  expect(get('huge', 'x'.repeat(11))).toHaveLength(11) // heavier than the limit: returned, not kept
  get('huge', 'x'.repeat(11))
  expect(make).toHaveBeenCalledTimes(3)
})

test('scanProject: unchanged files are not parsed again; an edit is', () => {
  const root = tmp()
  write(root, 'README.md', '# R\n\nFirst about.\n')
  write(root, '.specify/memory/constitution.md', '## Core Principles\n\n### I. One\n\nx\n\n**Version**: 1.0.0\n')
  write(root, 'specs/001-a/spec.md', '# S\n\n[NEEDS CLARIFICATION: q]\n')
  write(root, 'specs/001-a/tasks.md', '## P\n\n- [x] T001 a\n- [ ] T002 b\n')
  const first = scanProject(root, null)
  expect(work()).toBeGreaterThan(0)
  const before = work()
  expect(scanProject(root, null)).toEqual(first)
  expect(work()).toBe(before)

  write(root, 'README.md', '# R\n\nSecond about.\n')
  write(root, '.specify/memory/constitution.md', '## Core Principles\n\n### I. One\n\n### II. Two\n\n**Version**: 2.0.0\n')
  write(root, 'specs/001-a/spec.md', '# S\n')
  write(root, 'specs/001-a/tasks.md', '## P\n\n- [x] T001 a\n- [x] T002 b\n- [ ] T003 c\n')
  const second = scanProject(root, null)
  expect(second).toMatchObject({ about: 'Second about.', constitutionVersion: '2.0.0', principles: ['One', 'Two'] })
  expect(second.features[0]).toMatchObject({ tasks: { done: 2, total: 3 }, openQuestions: 0 })
  expect(first.features[0]).toMatchObject({ tasks: { done: 1, total: 2 }, openQuestions: 1 }) // an earlier result is not altered
  expect(first.principles).toEqual(['One'])
})

test('/api/doc: an unchanged document is parsed once; an edit is parsed again', async () => {
  const root = tmp(), webDir = tmp()
  write(root, 'specs/001-a/spec.md', '# First title\n')
  const s = await startServer({ root, port: 0, webDir })
  try {
    const get = async () => (await fetch(`http://127.0.0.1:${s.port}/api/doc?path=specs/001-a/spec.md`)).json()
    const a = await get()
    expect(await get()).toEqual(a)
    expect(parseDoc).toHaveBeenCalledTimes(1)
    write(root, 'specs/001-a/spec.md', '# Second title\n')
    const b = await get()
    expect(b.title).toBe('Second title')
    expect(b.ref.hash).not.toBe(a.ref.hash)
    expect(parseDoc).toHaveBeenCalledTimes(2)
  } finally { await s.close() }
})
