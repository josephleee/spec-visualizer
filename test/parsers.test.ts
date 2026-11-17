import { expect, test } from 'vitest'
import { parseChecklist, parseConstitution, parseDataModel, parseDoc, parsePlan, parseResearch, parseSpec, parseTasks } from '../server/parsers.ts'

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

const ref = (kind: any, path = 'specs/001-x/f.md') => ({ path, kind, hash: 'h' })

test('plan: Technical Context becomes fields', () => {
  const b = parsePlan('## Summary\n\nShort.\n\n## Technical Context\n\n**Language/Version**: Rust 1.75\n\n**Storage**: NEEDS CLARIFICATION\n')
  expect(b[0]).toMatchObject({ kind: 'raw', heading: 'Summary' })
  expect(b[1]).toMatchObject({ kind: 'fields', heading: 'Technical Context' })
  expect((b[1] as any).items).toEqual([{ label: 'Language/Version', value: 'Rust 1.75' }, { label: 'Storage', value: 'NEEDS CLARIFICATION' }])
})

test('constitution: principles become cards', () => {
  const b = parseConstitution('## Core Principles\n\nlead text\n\n### I. Library-First\n\nEvery feature starts as a library.\n\n### II. CLI\n\nText in, text out.\n\n## Governance\n\nRules.\n\n**Version**: 2.1.1 | **Ratified**: 2025-06-13 | **Last Amended**: 2025-07-16\n')
  expect(b[0]).toMatchObject({ kind: 'raw', heading: 'Core Principles', markdown: 'lead text' })
  expect((b[1] as any).items.map((i: any) => i.title)).toEqual(['I. Library-First', 'II. CLI'])
  const gov = b.find((x) => x.kind === 'fields') as any
  expect(gov.items[0]).toEqual({ label: 'Version', value: '2.1.1' })
  expect(gov.rest).toContain('Rules.')
})

test('research: decision cards; a topic with no Decision stays raw', () => {
  const b = parseResearch('## Research Topics\n\n### 1. PATH Lookup\n\n**Question**: How?\n\n**Decision**: Use which.\n\n**Rationale**:\n\n- small\n\n**Alternatives Considered**:\n\n- manual\n\n### 2. Notes\n\nfree text\n')
  expect(b[0]).toMatchObject({ kind: 'raw', heading: 'Research Topics', depth: 2 })
  const d = b.find((x) => x.kind === 'decisions') as any
  expect(d.items[0].title).toBe('1. PATH Lookup')
  expect(d.items[0].fields.map((f: any) => f.label)).toEqual(['Question', 'Decision', 'Rationale', 'Alternatives Considered'])
  expect(JSON.stringify(b)).toContain('free text')
})

test('data-model: entities become cards', () => {
  const b = parseDataModel('## Overview\n\nx\n\n## Entities\n\n### 1. PagerConfig\n\n| Field | Type |\n|---|---|\n| name | string |\n\n### 2. PagerProfile\n\ny\n')
  const c = b.find((x) => x.kind === 'cards') as any
  expect(c.items.map((i: any) => i.title)).toEqual(['1. PagerConfig', '2. PagerProfile'])
  expect(c.items[0].markdown).toContain('| name | string |')
})

test('parseDoc: title, meta, comments hidden, raw HTML kept as text', () => {
  const d = parseDoc(ref('plan'), '# Implementation Plan: Pager\n\n**Branch**: `010-pager` | **Date**: 2025-01-15\n\n## Summary\n\n<!-- ACTION REQUIRED -->\n\n<img src=x onerror=alert(1)>\n')
  expect(d.title).toBe('Implementation Plan: Pager')
  expect(d.meta.map((m) => m.label)).toEqual(['Branch', 'Date'])
  expect(JSON.stringify(d)).not.toContain('ACTION REQUIRED')
  expect(JSON.stringify(d)).toContain('onerror')
})

test('parseDoc: empty file, title only, CRLF, non-md contract', () => {
  expect(parseDoc(ref('spec'), '')).toMatchObject({ title: null, meta: [], blocks: [] })
  expect(parseDoc(ref('spec'), '# Only a title\n').blocks).toEqual([])
  expect(parseDoc(ref('tasks'), '## Phase 1: Setup\r\n\r\n- [x] T001 a\r\n').blocks[0]).toMatchObject({ kind: 'phase' })
  expect(parseDoc(ref('contract', 'specs/001-x/contracts/api.yaml'), 'openapi: 3.0.0\n').blocks)
    .toEqual([{ kind: 'code', lang: 'yaml', text: 'openapi: 3.0.0\n' }])
})

test('parseDoc: quickstart and other are raw sections', () => {
  const d = parseDoc(ref('other'), '# Analysis\n\nintro\n\n## Findings\n\nbody\n')
  expect(d.blocks).toEqual([
    { kind: 'raw', heading: null, depth: 0, markdown: 'intro' },
    { kind: 'raw', heading: 'Findings', depth: 2, markdown: 'body' },
  ])
})

test('research: topics written at ## level', () => {
  const one = parseResearch('# Research: Login\n\n## Session storage\n\n**Decision**: Signed cookie\n**Rationale**: No server-side store to run.\n**Alternatives considered**: Server sessions in Redis; JWT in local storage.\n')
  expect(one).toHaveLength(1)
  expect(one[0]).toMatchObject({ kind: 'decisions' })
  const it = (one[0] as any).items
  expect(it).toHaveLength(1)
  expect(it[0].title).toBe('Session storage')
  expect(it[0].fields.map((f: any) => f.label)).toEqual(['Decision', 'Rationale', 'Alternatives considered'])
  const two = parseResearch('## A\n\n**Decision**: x\n\n## B\n\n**decision**: y\n\n## Notes\n\nfree text\n')
  expect(two.map((b) => b.kind)).toEqual(['decisions', 'raw'])
  expect((two[0] as any).items.map((i: any) => i.title)).toEqual(['A', 'B'])
  expect(two[1]).toMatchObject({ heading: 'Notes', markdown: 'free text' })
})

test('spec: an id with one lowercase letter suffix is an id', () => {
  const fr = parseSpec('## Requirements\n\n### Functional Requirements\n\n- **FR-003a**: text\n').find((b) => b.kind === 'idList')!
  expect(fr.items).toEqual([{ id: 'FR-003a', text: 'text' }])
})

const GROUPED = `## Requirements

### Functional Requirements

Grouped by area.

#### Paging Modes

- **FR-001**: System MUST page long output
- **FR-003a**: System MUST spawn the pager first

#### Security

- **FR-005a**: System MUST not run a shell
- a note with no id

#### Notes

Free text about the groups.

### Key Entities

- **Pager**: a program
`

test('spec: #### groups under a ### become their own blocks, in file order, nothing dropped', () => {
  expect(parseSpec(GROUPED)).toEqual([
    { kind: 'raw', heading: 'Requirements', depth: 2, markdown: '' },
    { kind: 'raw', heading: 'Functional Requirements', depth: 3, markdown: 'Grouped by area.' },
    { kind: 'idList', heading: 'Paging Modes', depth: 4, items: [
      { id: 'FR-001', text: 'System MUST page long output' }, { id: 'FR-003a', text: 'System MUST spawn the pager first' }], rest: '' },
    { kind: 'idList', heading: 'Security', depth: 4, items: [{ id: 'FR-005a', text: 'System MUST not run a shell' }], rest: '- a note with no id' },
    { kind: 'raw', heading: 'Notes', depth: 4, markdown: 'Free text about the groups.' },
    { kind: 'raw', heading: 'Key Entities', depth: 3, markdown: '- **Pager**: a program' },
  ])
})

test('spec: id items before the first #### make an idList with the ### title', () => {
  const blocks = parseSpec('## Requirements\n\n### Functional Requirements\n\n- **FR-001**: first\n\n#### Later\n\n- **FR-002**: second\n')
  expect(blocks.slice(1)).toEqual([
    { kind: 'idList', heading: 'Functional Requirements', depth: 3, items: [{ id: 'FR-001', text: 'first' }], rest: '' },
    { kind: 'idList', heading: 'Later', depth: 4, items: [{ id: 'FR-002', text: 'second' }], rest: '' },
  ])
})

test('spec: a ### with no #### keeps one idList with its depth', () => {
  const fr = parseSpec(SPEC).find((b) => b.kind === 'idList')!
  expect(fr).toMatchObject({ heading: 'Functional Requirements', depth: 3 })
})
