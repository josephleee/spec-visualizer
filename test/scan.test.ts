import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isSpecKit, kindOf, scanProject, stageOf } from '../server/scan.ts'

const dirs: string[] = []
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-')); dirs.push(d); return d }
const write = (root: string, rel: string, text: string) => {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

test('stageOf follows the five rules', () => {
  expect(stageOf({ tasks: null, hasPlan: false })).toBe('specify')
  expect(stageOf({ tasks: null, hasPlan: true })).toBe('plan')
  expect(stageOf({ tasks: { done: 0, total: 3 }, hasPlan: false })).toBe('tasks')
  expect(stageOf({ tasks: { done: 1, total: 3 }, hasPlan: true })).toBe('implement')
  expect(stageOf({ tasks: { done: 3, total: 3 }, hasPlan: true })).toBe('done')
  expect(stageOf({ tasks: { done: 0, total: 0 }, hasPlan: true })).toBe('tasks')
})

test('kindOf', () => {
  expect(kindOf('spec.md')).toBe('spec')
  expect(kindOf('checklists/requirements.md')).toBe('checklist')
  expect(kindOf('contracts/api.yaml')).toBe('contract')
  expect(kindOf('analysis.md')).toBe('other')
})

test('scanProject: features, counts, current feature first', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', '# C\n\n**Version**: 1.2.0 | **Ratified**: 2025-01-01\n')
  write(root, 'specs/001-search/spec.md', '# S\n\n- **FR-001**: x [NEEDS CLARIFICATION: y]\n<!-- or NEEDS CLARIFICATION -->\n')
  write(root, 'specs/001-search/plan.md', '**Storage**: NEEDS CLARIFICATION\n')
  write(root, 'specs/002-pager/spec.md', '# P\n')
  write(root, 'specs/002-pager/tasks.md', '## Phase 1\n\n- [x] T001 a\n- [ ] T002 b\n')
  write(root, 'specs/002-pager/analysis.md', '# A\n')
  write(root, 'specs/002-pager/notes.txt', 'ignored')
  write(root, 'specs/README.md', 'not a feature')
  const p = scanProject(root, '002-pager')
  expect(p.constitutionVersion).toBe('1.2.0')
  expect(p.currentFeature).toBe('002-pager')
  expect(p.features.map((f) => f.id)).toEqual(['002-pager', '001-search'])
  expect(p.features[0]).toMatchObject({ stage: 'implement', tasks: { done: 1, total: 2 }, openQuestions: 0 })
  expect(p.features[0].docs.map((d) => d.kind)).toEqual(['spec', 'tasks', 'other'])
  expect(p.features[0].docs[0].path).toBe('specs/002-pager/spec.md')
  expect(p.features[1]).toMatchObject({ stage: 'plan', tasks: null, openQuestions: 2 })
  expect(p.features[1].docs[0].hash).toMatch(/^[0-9a-f]{12}$/)
})

test('scanProject: no match for the branch, empty specs, symlink out of the project', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, 'specs/003-x'), { recursive: true })
  const outside = tmp(); write(outside, 'secret.md', 'secret')
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'specs/003-x/link.md'))
  fs.symlinkSync(outside, path.join(root, 'specs/004-linked'))
  const p = scanProject(root, 'main')
  expect(p.currentFeature).toBeNull()
  expect(p.constitution).toBeNull()
  expect(p.features).toEqual([{ id: '003-x', stage: 'specify', docs: [], tasks: null, openQuestions: 0 }])
})

test('scanProject: nested docs, dot-entries, unreadable file', () => {
  const root = tmp()
  write(root, 'specs/005-y/contracts/api.yaml', 'a: 1')
  write(root, 'specs/005-y/checklists/r.md', '- [ ] a')
  write(root, 'specs/005-y/.hidden.md', 'h')
  const bad = path.join(root, 'specs/005-y/spec.md')
  write(root, 'specs/005-y/spec.md', '# s')
  fs.chmodSync(bad, 0)
  const p = scanProject(root, null)
  fs.chmodSync(bad, 0o644)
  const docs = p.features[0].docs
  expect(docs.map((d) => d.path)).toEqual(['specs/005-y/spec.md', 'specs/005-y/contracts/api.yaml', 'specs/005-y/checklists/r.md'])
  if (process.getuid?.() !== 0) expect(docs[0]).toMatchObject({ hash: '', error: expect.any(String) })
})

const root0 = process.getuid?.() === 0

test('scanProject: symlinked .specify, memory or specs is never followed', () => {
  const outside = tmp(); write(outside, 'memory/constitution.md', '**Version**: 9.9.9\n'); write(outside, '001-a/spec.md', '# a')
  const r1 = tmp(); fs.symlinkSync(outside, path.join(r1, '.specify'))
  expect(scanProject(r1, null).constitution).toBeNull()
  const r2 = tmp(); fs.mkdirSync(path.join(r2, '.specify'))
  fs.symlinkSync(path.join(outside, 'memory'), path.join(r2, '.specify/memory'))
  expect(scanProject(r2, null)).toMatchObject({ constitution: null, constitutionVersion: null })
  const r3 = tmp(); fs.symlinkSync(outside, path.join(r3, 'specs'))
  expect(scanProject(r3, null).features).toEqual([])
})

test('scanProject: .specify as a regular file does not abort', () => {
  const r = tmp(); write(r, '.specify', 'x')
  expect(scanProject(r, null).constitution).toBeNull()
  expect(isSpecKit(r)).toBe(false)
})

test('scanProject: unreadable directories are skipped', () => {
  const r = tmp()
  write(r, 'specs/001-a/spec.md', '# a'); write(r, 'specs/001-a/sub/x.md', 'x'); write(r, 'specs/002-b/spec.md', '# b')
  const locked = [path.join(r, 'specs/001-a/sub'), path.join(r, 'specs/002-b')]
  locked.forEach((d) => fs.chmodSync(d, 0))
  try {
    const p = scanProject(r, null)
    if (!root0) {
      expect(p.features.map((f) => [f.id, f.docs.length])).toEqual([['001-a', 1], ['002-b', 0]])
    }
  } finally { locked.forEach((d) => fs.chmodSync(d, 0o755)) }
})

test('isSpecKit', () => {
  const root = tmp()
  expect(isSpecKit(root)).toBe(false)
  fs.mkdirSync(path.join(root, '.specify'))
  expect(isSpecKit(root)).toBe(true)
})

const CONSTITUTION = '# C\n\n## Core Principles\n\n### I. Library First\n\nx\n\n### 2. Test First\n\ny\n\n### Plain Title\n\nz\n\n## Governance\n\n### IV. Not a principle\n\nRules.\n\n**Version**: 2.1.1 | **Ratified**: 2025-06-13 | **Last Amended**: 2025-07-16\n'

test('scanProject: constitution dates and principle titles', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', CONSTITUTION)
  expect(scanProject(root, null)).toMatchObject({
    constitutionVersion: '2.1.1', constitutionRatified: '2025-06-13', constitutionAmended: '2025-07-16',
    principles: ['Library First', 'Test First', 'Plain Title'], about: null,
  })
  expect(scanProject(tmp(), null)).toMatchObject({ constitutionRatified: null, constitutionAmended: null, principles: [], about: null })
})

test('scanProject: about is the first prose paragraph of the README', () => {
  const root = tmp()
  write(root, 'readme.md', '<p align="center"><img src="logo.png"></p>\n\n# hl\n\n[![ci](https://x/b.svg)](https://x/ci) ![cov](c.svg)\n\n![shot](shot.png)\n\n<!-- hidden -->\n\nA **fast** log viewer for\n[JSON logs](https://example.com) and `logfmt`.\n\nSecond paragraph.\n')
  expect(scanProject(root, null).about).toBe('A fast log viewer for JSON logs and logfmt.')
})

test('scanProject: a long about is cut at a word boundary within 300 characters', () => {
  const root = tmp()
  write(root, 'README.md', '# T\n\n' + 'word '.repeat(100) + '\n')
  const about = scanProject(root, null).about!
  expect(about.length).toBeLessThanOrEqual(300)
  expect(about).toMatch(/^(word )+word…$/)
  const one = tmp(); write(one, 'README.md', 'x'.repeat(400))
  expect(scanProject(one, null).about).toBe('x'.repeat(299) + '…')
})

test('scanProject: README that is a symlink, a directory, unreadable or without prose gives null', () => {
  const outside = tmp(); write(outside, 'secret.md', 'secret words')
  const r1 = tmp(); fs.symlinkSync(path.join(outside, 'secret.md'), path.join(r1, 'README.md'))
  expect(scanProject(r1, null).about).toBeNull()
  const r2 = tmp(); fs.mkdirSync(path.join(r2, 'README.md'))
  expect(scanProject(r2, null).about).toBeNull()
  const r3 = tmp(); write(r3, 'README.md', '# Only a title\n\n![img](a.png)\n')
  expect(scanProject(r3, null).about).toBeNull()
  const r4 = tmp(); write(r4, 'README.md', 'words'); fs.chmodSync(path.join(r4, 'README.md'), 0)
  if (!root0) expect(scanProject(r4, null).about).toBeNull()
})

test('scanProject: a constitution label value is its own line only', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', '# C\n\n**Version**: 9.9.9\n\n## Core Principles\n\n### I. A\n\ntext\n\n## Governance\n\n**Ratified**: 2025-06-13 | **Last Amended**: 2025-07-16\nfooter line\n\nFooter paragraph.\n')
  expect(scanProject(root, null)).toMatchObject({ constitutionVersion: '9.9.9', constitutionRatified: '2025-06-13', constitutionAmended: '2025-07-16' })
})

test('scanProject: principle titles lose only an I/V/X or digit prefix and are plain text', () => {
  const root = tmp()
  const titles = ['A. Accuracy', 'C. Consistency', 'D. Docs', 'MIX. Odd', 'IV. **Bold** and `code`', '3) Third', 'XII. Twelfth']
  write(root, '.specify/memory/constitution.md', '## Core Principles\n\n' + titles.map((t) => `### ${t}\n\nx\n`).join('\n'))
  expect(scanProject(root, null).principles).toEqual(['A. Accuracy', 'C. Consistency', 'D. Docs', 'MIX. Odd', 'Bold and code', 'Third', 'Twelfth'])
})

test('scanProject: about is cut by code points and only the first 64 KB of the README is read', () => {
  const emoji = tmp(); write(emoji, 'README.md', '😀'.repeat(400))
  const about = scanProject(emoji, null).about!
  expect([...about]).toHaveLength(300)
  expect([...about].slice(0, 299).every((c) => c === '😀')).toBe(true) // no half of a pair
  expect(about.endsWith('…')).toBe(true)
  const huge = tmp(); write(huge, 'README.md', '![i](a.png)\n\n'.repeat(6000) + 'late prose\n')
  expect(scanProject(huge, null).about).toBeNull()
})

test('scanProject: a long CRLF README and one of exactly 64 KB still give the first paragraph', () => {
  const crlf = tmp(); write(crlf, 'README.md', '# T\r\n\r\nFirst words.\r\n\r\n' + 'filler line\r\n'.repeat(6000))
  expect(scanProject(crlf, null).about).toBe('First words.')
  const exact = tmp(); write(exact, 'README.md', 'x '.repeat(32768).trimEnd() + 'y')
  expect(fs.statSync(path.join(exact, 'README.md')).size).toBe(65536)
  expect(scanProject(exact, null).about).toMatch(/^(x )+x…$/)
  const over = tmp(); write(over, 'README.md', 'x '.repeat(40000))
  expect(scanProject(over, null).about).toBeNull() // one unfinished block: nothing complete to show
})

test('scanProject: an empty constitution label is null, not the next block', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', '# C\n\n**Version**:\n\nSome paragraph.\n\n**Ratified**: | **Last Amended**:\nnext line\n\n- list\n')
  expect(scanProject(root, null)).toMatchObject({ constitutionVersion: null, constitutionRatified: null, constitutionAmended: null })
})

test('scanProject: principle titles with no text are left out', () => {
  const root = tmp()
  write(root, '.specify/memory/constitution.md', '## Core Principles\n\n### ![img](a.png)\n\nx\n\n###\n\ny\n\n### I. Real\n\nz\n')
  expect(scanProject(root, null).principles).toEqual(['Real'])
})
