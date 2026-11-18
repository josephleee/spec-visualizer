import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseDoc } from '../server/parsers.ts'
import { changeKindOf, changeStageOf, isOpenSpec, OPENSPEC_PARSERS, scanOpenSpec } from '../server/openspec.ts'
import type { Block, DocKind } from '../server/types.ts'

const dirs: string[] = []
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-os-')); dirs.push(d); return d }
const write = (root: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

const read = (kind: DocKind, src: string, file = 'openspec/specs/x/spec.md') => parseDoc({ path: file, kind, hash: 'h' }, src, { parsers: OPENSPEC_PARSERS })
type Reqs = Extract<Block, { kind: 'requirements' }>
const reqs = (blocks: Block[]) => blocks.filter((b): b is Reqs => b.kind === 'requirements')

const MAIN = `# loans Specification

## Purpose
Members borrow tools at the counter and bring them back.

## Requirements

### Requirement: Check out a tool
The desk SHALL lend a tool to a member in good standing.

#### Scenario: Member in good standing
- **GIVEN** a member with no overdue loans
- **WHEN** the clerk scans the tool and the card
- **THEN** the loan is recorded with a due date
- **AND** the tool shows as lent

#### Scenario: Card blocked
- WHEN the member has an overdue loan
- THEN the desk refuses the loan
  and says which tool is overdue

### Requirement: Return a tool
The desk MUST record a return the moment the tool is scanned.

#### Scenario: On time
- **WHEN** the tool is scanned before its due date
- **THEN** the loan closes with no fee
`

test('a main spec: requirements with their statement and named scenarios, steps in order', () => {
  const doc = read('capability', MAIN)
  expect(doc.title).toBe('loans Specification')
  expect(doc.blocks[0]).toEqual({ kind: 'raw', heading: 'Purpose', depth: 2, markdown: 'Members borrow tools at the counter and bring them back.' })
  const [b] = reqs(doc.blocks)
  expect(b).toMatchObject({ heading: 'Requirements', op: null, text: '', rest: '' })
  expect(b.items.map((r) => r.title)).toEqual(['Check out a tool', 'Return a tool'])
  expect(b.items[0].text).toBe('The desk SHALL lend a tool to a member in good standing.')
  expect(b.items[0].criteria.map((c) => c.name)).toEqual(['Member in good standing', 'Card blocked'])
  expect(b.items[0].criteria[0].steps).toEqual([
    { key: 'GIVEN', text: 'a member with no overdue loans' }, { key: 'WHEN', text: 'the clerk scans the tool and the card' },
    { key: 'THEN', text: 'the loan is recorded with a due date' }, { key: 'AND', text: 'the tool shows as lent' }])
  expect(b.items[0].criteria[1].steps[1]).toEqual({ key: 'THEN', text: 'the desk refuses the loan\n  and says which tool is overdue' })
})

const DELTA = `## Purpose
Reminders before a loan falls due.

## ADDED Requirements

### Requirement: Remind before the due date
The system SHALL send a reminder two days before a loan is due.

#### Scenario: Two days left
- **WHEN** a loan is due in two days
- **THEN** the member gets one reminder

## MODIFIED Requirements

Text before the first requirement stays with its section.

### Requirement: Return a tool
The desk MUST record a return the moment the tool is scanned, and stop its reminders.

#### Scenario: On time
- **WHEN** the tool is scanned before its due date
- **THEN** the loan closes with no fee

### Notes
A heading that is not a requirement is kept.

## REMOVED Requirements

### Requirement: Paper reminder slips
**Reason**: replaced by sent reminders.

## RENAMED Requirements

- FROM: \`### Requirement: Check out a tool\`
- TO: \`### Requirement: Lend a tool\`
`

test('a delta spec: each section is one block with its operation; nothing is lost', () => {
  const doc = read('delta', DELTA, 'openspec/changes/add-reminders/specs/loans/spec.md')
  const [added, modified, removed, renamed] = reqs(doc.blocks)
  expect([added.op, modified.op, removed.op, renamed.op]).toEqual(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'])
  expect(added.items[0].criteria[0].steps.map((s) => s.key)).toEqual(['WHEN', 'THEN'])
  expect(modified.text).toBe('Text before the first requirement stays with its section.')
  expect(modified.rest).toBe('### Notes\n\nA heading that is not a requirement is kept.')
  expect(removed.items[0]).toMatchObject({ title: 'Paper reminder slips', text: '**Reason**: replaced by sent reminders.', criteria: [] })
  expect(renamed.items).toEqual([])
  expect(renamed.text).toContain('FROM: `### Requirement: Check out a tool`')
  expect(doc.blocks[0]).toMatchObject({ kind: 'raw', heading: 'Purpose' })
})

test('a spec section that is not about requirements, and a requirements heading with no requirement, stay raw', () => {
  const doc = read('capability', '# x\n\n## Requirements\n\nNone yet.\n\n## Glossary\n\n- term\n')
  expect(doc.blocks.map((b) => b.kind)).toEqual(['raw', 'raw'])
})

test('tasks.md: one phase per numbered group, numbers as ids, any one-character mark is a task, nested notes kept', () => {
  const doc = read('tasks', `# Tasks

## 1. Reminder job

- [x] 1.1 Add the reminder table
- [~] 1.2 Schedule the daily job
  - runs at 07:00 local time
- [ ] 1.3 Send the mail
  - [x] 1.3.1 Template

## 2. Docs

- [ ] 2.1 Write the help page
- [Some link](https://example.com)
`, 'openspec/changes/x/tasks.md')
  const phases = doc.blocks.filter((b) => b.kind === 'phase')
  expect(phases.map((p) => p.kind === 'phase' && p.title)).toEqual(['1. Reminder job', '2. Docs'])
  const items = phases.flatMap((p) => (p.kind === 'phase' ? p.items : []))
  expect(items.map((i) => [i.id, i.done, i.text])).toEqual([
    ['1.1', true, 'Add the reminder table'], ['1.2', false, 'Schedule the daily job'], ['1.3', false, 'Send the mail'],
    ['1.3.1', true, 'Template'], ['2.1', false, 'Write the help page']])
  expect(items[1].notes).toBe('- runs at 07:00 local time')
  expect(phases[1].kind === 'phase' && phases[1].rest).toBe('- [Some link](https://example.com)') // a link item is not a task
})

test('the kind of a file in a change folder', () => {
  expect(changeKindOf('proposal.md')).toBe('proposal')
  expect(changeKindOf('design.md')).toBe('design')
  expect(changeKindOf('tasks.md')).toBe('tasks')
  expect(changeKindOf('specs/loans/spec.md')).toBe('delta')
  expect(changeKindOf('specs/identity/user-auth/spec.md')).toBe('delta')
  expect(changeKindOf('specs/spec.md')).toBe('other')
  expect(changeKindOf('notes.md')).toBe('other')
})

test('the stage of a change: archived, then tasks ticked, tasks written, design written, else propose', () => {
  expect(changeStageOf({ archived: true, tasks: { done: 1, total: 4 }, hasDesign: true })).toBe('archive')
  expect(changeStageOf({ archived: false, tasks: { done: 4, total: 4 }, hasDesign: true })).toBe('apply') // done but not archived
  expect(changeStageOf({ archived: false, tasks: { done: 1, total: 4 }, hasDesign: false })).toBe('apply')
  expect(changeStageOf({ archived: false, tasks: { done: 0, total: 4 }, hasDesign: true })).toBe('tasks')
  expect(changeStageOf({ archived: false, tasks: null, hasDesign: true })).toBe('design')
  expect(changeStageOf({ archived: false, tasks: null, hasDesign: false })).toBe('propose')
})

test('scanOpenSpec: specs and context are shared, changes then archived ones newest first, counts and stages', () => {
  const root = tmp()
  write(root, 'openspec/config.yaml', 'schema: spec-driven\n')
  write(root, 'openspec/specs/loans/spec.md', MAIN)
  write(root, 'openspec/specs/identity/members/spec.md', '# members\n')
  write(root, 'openspec/specs/spec.md', '# not in a capability folder\n')
  write(root, 'openspec/changes/add-reminders/proposal.md', '## Why\n\nx\n')
  write(root, 'openspec/changes/add-reminders/specs/loans/spec.md', DELTA)
  write(root, 'openspec/changes/add-reminders/tasks.md', '## 1. A\n\n- [x] 1.1 a\n- [ ] 1.2 b\n')
  write(root, 'openspec/changes/add-reminders/.openspec.yaml', 'schema: spec-driven\n')
  write(root, 'openspec/changes/add-reminders/notes.md', '# notes\n')
  write(root, 'openspec/changes/a-first/proposal.md', '## Why\n')
  write(root, 'openspec/changes/archive/2026-01-02-old/tasks.md', '- [x] 1 done\n')
  write(root, 'openspec/changes/archive/2026-03-04-newer/proposal.md', '## Why\n')
  const p = scanOpenSpec(root, null)
  expect(p.format).toBe('openspec')
  expect(p.shared!.map((d) => [d.path, d.kind])).toEqual([
    ['openspec/specs/identity/members/spec.md', 'capability'], ['openspec/specs/loans/spec.md', 'capability'], ['openspec/config.yaml', 'context']])
  expect(p.features.map((f) => [f.id, f.stage])).toEqual([
    ['a-first', 'propose'], ['add-reminders', 'apply'], ['archive/2026-03-04-newer', 'archive'], ['archive/2026-01-02-old', 'archive']])
  const f = p.features[1]
  expect(f.tasks).toEqual({ done: 1, total: 2 })
  expect(f.docs.map((d) => d.kind)).toEqual(['proposal', 'delta', 'tasks', 'other'])
  expect(p.features[3].tasks).toEqual({ done: 1, total: 1 }) // a task list before any ## counts too
  expect(p.constitution).toBeNull()
  expect(scanOpenSpec(root, 'add-reminders').features[0].id).toBe('add-reminders')
})

test('isOpenSpec needs a real openspec/ directory', () => {
  const root = tmp()
  expect(isOpenSpec(root)).toBe(false)
  write(root, 'openspec', 'a file')
  expect(isOpenSpec(root)).toBe(false)
  const other = tmp()
  fs.mkdirSync(path.join(other, 'real'))
  fs.symlinkSync(path.join(other, 'real'), path.join(root, 'link'))
  const linked = tmp()
  fs.symlinkSync(path.join(other, 'real'), path.join(linked, 'openspec'))
  expect(isOpenSpec(linked)).toBe(false)
  fs.mkdirSync(path.join(other, 'openspec'))
  expect(isOpenSpec(other)).toBe(true)
})

test('scanOpenSpec never follows a symlinked change or spec folder', () => {
  const root = tmp(), outside = tmp()
  write(outside, 'proposal.md', '# secret\n')
  write(root, 'openspec/changes/real/proposal.md', '# ok\n')
  fs.symlinkSync(outside, path.join(root, 'openspec/changes/linked'))
  fs.mkdirSync(path.join(root, 'openspec/specs'), { recursive: true })
  fs.symlinkSync(outside, path.join(root, 'openspec/specs/linked'))
  const p = scanOpenSpec(root, null)
  expect(p.features.map((f) => f.id)).toEqual(['real'])
  expect(p.shared).toEqual([])
})
