import { expect, test } from 'vitest'
import { parseChecklist, parseSpec, parseTasks } from '../server/parsers.ts'

const SPEC = `# Feature Specification: Pager

## User Scenarios & Testing

### User Story 1 - Configure pager (Priority: P1)

Users set a pager.

**Why this priority**: Core value.

**Independent Test**: Set config and run.

**Acceptance Scenarios**:

1. **Given** a config, **When** output is long, **Then** less opens
2. A scenario in free text

### Edge Cases

- What if less is missing?

## Requirements

### Functional Requirements

- **FR-001**: System MUST read the pager
- **FR-006**: System MUST use [NEEDS CLARIFICATION: which default?]
- a line with no id

## Migration Notes

Old configs keep PAGER.
`

test('spec: stories, scenarios and id lists', () => {
  const blocks = parseSpec(SPEC)
  const stories = blocks.find((b) => b.kind === 'stories')!
  expect(stories.items[0]).toMatchObject({ title: 'Configure pager', priority: 'P1', why: 'Core value.', test: 'Set config and run.' })
  expect(stories.items[0].scenarios).toEqual([{ given: 'a config', when: 'output is long', then: 'less opens' }])
  expect(stories.items[0].rest).toContain('A scenario in free text')
  expect(stories.items[0].rest).toContain('Users set a pager.')
  const fr = blocks.find((b) => b.kind === 'idList')!
  expect(fr.items.map((i) => i.id)).toEqual(['FR-001', 'FR-006'])
  expect(fr.rest).toContain('a line with no id')
})

test('spec: nothing is dropped and order is kept', () => {
  const blocks = parseSpec(SPEC)
  const all = JSON.stringify(blocks)
  for (const s of ['What if less is missing?', 'Old configs keep PAGER.', 'NEEDS CLARIFICATION: which default?'])
    expect(all).toContain(s)
  expect(blocks.map((b) => b.kind)).toEqual(['raw', 'stories', 'raw', 'raw', 'idList', 'raw'])
  expect(blocks[0]).toEqual({ kind: 'raw', heading: 'User Scenarios & Testing', depth: 2, markdown: '' })
  expect(blocks[3]).toEqual({ kind: 'raw', heading: 'Requirements', depth: 2, markdown: '' })
})

test('spec: a file that matches nothing is all raw', () => {
  const blocks = parseSpec('# Notes\n\n## Anything\n\nfree text\n')
  expect(blocks).toEqual([{ kind: 'raw', heading: 'Anything', depth: 2, markdown: 'free text' }])
})

test('spec: text between ## and first ### stays raw, unknown labels survive', () => {
  const blocks = parseSpec('## Req\n\nintro\n\n### User Story 2 - Two\n\n**Note**: keep me\n')
  expect(blocks[0]).toEqual({ kind: 'raw', heading: 'Req', depth: 2, markdown: 'intro' })
  expect(blocks[1]).toMatchObject({ kind: 'stories', items: [{ title: 'Two', priority: null, rest: '**Note**: keep me' }] })
})

const TASKS = `# Tasks: Pager

## Format: \`[ID] [P?] [Story] Description\`

- **[P]**: Can run in parallel

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization

- [x] T001 Add which crate
- [ ] T003 [P] Create config

## Phase 3: User Story 1 - Configure (Priority: P1) 🎯 MVP

**Goal**: Deliver config

### Tests for User Story 1

- [ ] T010 [P] [US1] Contract test

**Checkpoint**: Story 1 works
`

test('tasks: phases, fields, items; sections with no checkbox stay raw', () => {
  const blocks = parseTasks(TASKS)
  expect(blocks.map((b) => b.kind)).toEqual(['raw', 'phase', 'phase'])
  const [, p1, p3] = blocks as any[]
  expect(p1.title).toBe('Phase 1: Setup (Shared Infrastructure)')
  expect(p1.fields).toEqual([{ label: 'Purpose', value: 'Project initialization' }])
  expect(p1.items.map((i: any) => [i.id, i.done, i.parallel])).toEqual([['T001', true, false], ['T003', false, true]])
  expect(p3.items[0]).toMatchObject({ id: 'T010', story: 'US1', parallel: true })
  expect(p3.fields.map((f: any) => f.label)).toEqual(['Goal', 'Checkpoint'])
  expect(p3.rest).toContain('Tests for User Story 1')
})

test('checklist: items without an ID count', () => {
  const blocks = parseChecklist('# Checklist\n\n## Content Quality\n\n- [x] No implementation details\n- [ ] CHK002 Focused on value\n\n## Notes\n\n- plain\n')
  expect(blocks.map((b) => b.kind)).toEqual(['phase', 'raw'])
  expect((blocks[0] as any).items).toHaveLength(2)
  expect((blocks[0] as any).items[0]).toMatchObject({ id: null, done: true })
})

test('phase: plain lists stay in content, checkbox lists do not leak into fields', () => {
  const [p] = parseTasks('## P\n\n**Goal**: g\n\n- plain note\n\n* [ ] T001 x\n') as any[]
  expect(p.fields).toEqual([{ label: 'Goal', value: 'g\n\n- plain note' }])
  expect(p.items).toHaveLength(1)
})

test('phase: plain items of a mixed list go to rest', () => {
  const [p] = parseTasks('## P\n\n- [x] T001 a\n- plain note\n- [ ] T002 b\n') as any[]
  expect(p.items).toHaveLength(2)
  expect(p.rest).toBe('- plain note')
})

test('phase: a heading ends the label value', () => {
  const [p] = parseTasks('## Phase 2: X\n\n**Goal**: Deliver\n\n### Tests\n\nWrite these first.\n\n- [ ] T001 a\n\n**Checkpoint**: ok\n') as any[]
  expect(p.fields).toEqual([{ label: 'Goal', value: 'Deliver' }, { label: 'Checkpoint', value: 'ok' }])
  expect(p.rest).toContain('### Tests')
  expect(p.rest).toContain('Write these first.')
})

test('phase: ordered mixed list keeps its markers exactly', () => {
  const [p] = parseTasks('## P\n\n1. [ ] T001 a\n2. second plain\n') as any[]
  expect(p.items).toHaveLength(1)
  expect(p.rest).toBe('2. second plain')
})

test('phase: content nested under a checkbox item is kept in rest', () => {
  const [p] = parseTasks('## P\n\n- [ ] T001 a\n  - nested detail\n  ```\n  code\n  ```\n\n  second para\n  - [x] T002 sub\n    > quote\n') as any[]
  expect(p.items.map((i: any) => i.id)).toEqual(['T001', 'T002'])
  expect(p.rest).toContain('- nested detail')
  expect(p.rest).toContain('code')
  expect(p.rest).toContain('> quote')
  expect(p.rest).not.toContain('T002')
})
