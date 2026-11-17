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

test('isSpecKit', () => {
  const root = tmp()
  expect(isSpecKit(root)).toBe(false)
  fs.mkdirSync(path.join(root, '.specify'))
  expect(isSpecKit(root)).toBe(true)
})
