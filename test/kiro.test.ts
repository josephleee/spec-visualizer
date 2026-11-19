import { afterAll, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseDoc } from '../server/parsers.ts'
import { ears, isKiro, KIRO_PARSERS, scanKiro, specKindOf, specStageOf } from '../server/kiro.ts'
import type { Block, DocKind } from '../server/types.ts'

const dirs: string[] = []
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-kiro-')); dirs.push(d); return d }
const write = (root: string, rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }) })

const read = (kind: DocKind, src: string, file = '.kiro/specs/x/requirements.md') => parseDoc({ path: file, kind, hash: 'h' }, src, { parsers: KIRO_PARSERS, frontMatter: true })
type Reqs = Extract<Block, { kind: 'requirements' }>
const reqs = (blocks: Block[]) => blocks.filter((b): b is Reqs => b.kind === 'requirements')
const phases = (blocks: Block[]) => blocks.flatMap((b) => (b.kind === 'phase' ? [b] : []))

test('EARS sentences split into condition and response, in every form Kiro writes', () => {
  expect(ears('WHEN the member scans a card THEN the system SHALL show the loans')).toEqual([
    { key: 'WHEN', text: 'the member scans a card' }, { key: 'THEN', text: 'the system SHALL show the loans' }])
  expect(ears('WHEN the card is blocked, THE Desk SHALL refuse the loan')).toEqual([
    { key: 'WHEN', text: 'the card is blocked' }, { key: 'THEN', text: 'THE Desk SHALL refuse the loan' }])
  expect(ears('IF the tool is missing, THEN the Desk SHALL say so')).toEqual([
    { key: 'IF', text: 'the tool is missing' }, { key: 'THEN', text: 'the Desk SHALL say so' }])
  expect(ears('WHILE a loan is open THE Catalog SHALL show the tool as lent')).toEqual([
    { key: 'WHILE', text: 'a loan is open' }, { key: 'THEN', text: 'THE Catalog SHALL show the tool as lent' }])
  expect(ears('WHERE fees are enabled THE Desk SHALL add the fee to the receipt')[0]).toEqual({ key: 'WHERE', text: 'fees are enabled' })
  expect(ears('WHEN a member signs up\nTHE SYSTEM SHALL send a welcome mail')[1]).toEqual({ key: 'THEN', text: 'THE SYSTEM SHALL send a welcome mail' })
  expect(ears('**WHEN** a tool is returned **THEN** the system **SHALL** close the loan')).toEqual([
    { key: 'WHEN', text: 'a tool is returned' }, { key: 'THEN', text: 'the system **SHALL** close the loan' }])
  expect(ears('THE Desk SHALL keep a log')).toEqual([{ key: '', text: 'THE Desk SHALL keep a log' }]) // no condition
  expect(ears('When asked, show it')).toEqual([{ key: '', text: 'When asked, show it' }]) // not uppercase: a sentence
  expect(ears('WHEN nothing follows')).toEqual([{ key: 'WHEN', text: 'nothing follows' }])
})

const REQUIREMENTS = `# Requirements Document

## Introduction

Members find a tool in the catalog by name.

## Glossary

- **Catalog**: the list of tools the library owns.

## Requirements

### Requirement 1: Search by name

**User Story:** As a member, I want to search tools by name, so that I find a drill quickly.

#### Acceptance Criteria

1. WHEN a member types a name THEN the Catalog SHALL list matching tools
2. IF nothing matches, THEN the Catalog SHALL say so
3. THE Catalog SHALL ignore letter case

### Requirement 2

**Objective:** As a clerk, I want lent tools marked, so that nobody walks to an empty shelf.

#### Acceptance Criteria

1. WHILE a tool is lent THE Catalog SHALL show its due date

#### Notes

Shown on the counter screen too.
`

test('requirements.md: numbered requirements with their user story and criteria numbered under them', () => {
  const doc = read('requirements', REQUIREMENTS)
  expect(doc.title).toBe('Requirements Document')
  expect(doc.blocks.map((b) => [b.kind, 'heading' in b ? b.heading : null])).toEqual([['raw', 'Introduction'], ['raw', 'Glossary'], ['requirements', 'Requirements']])
  const [b] = reqs(doc.blocks)
  const [r1, r2] = b.items
  expect(r1).toMatchObject({ id: '1', title: 'Search by name', story: 'As a member, I want to search tools by name, so that I find a drill quickly.', text: '', rest: '' })
  expect(r1.criteria.map((c) => [c.id, c.steps.map((s) => s.key)])).toEqual([['1.1', ['WHEN', 'THEN']], ['1.2', ['IF', 'THEN']], ['1.3', ['']]])
  expect(r2).toMatchObject({ id: '2', title: 'Requirement 2', story: 'As a clerk, I want lent tools marked, so that nobody walks to an empty shelf.' })
  expect(r2.criteria[0].id).toBe('2.1')
  expect(r2.rest).toBe('#### Notes\n\nShown on the counter screen too.')
})

test('bugfix.md: each behaviour group is an item, its numbered lines the criteria', () => {
  const doc = read('requirements', `# Bugfix Requirements Document

## Introduction

Late fees are rounded the wrong way.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a loan is 36 hours late THEN the system charges two days

1.2 WHEN a loan is 1 hour late THEN the system charges one day

### Expected Behavior (Correct)

2.1 WHEN a loan is 36 hours late THEN the system SHALL charge one and a half days

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a loan is returned on time THEN the system SHALL CONTINUE TO charge nothing

A remark under the last group.
`, '.kiro/specs/fix/bugfix.md')
  const [b] = reqs(doc.blocks)
  expect(b.heading).toBe('Bug Analysis')
  expect(b.items.map((i) => [i.title, i.criteria.map((c) => c.id)])).toEqual([
    ['Current Behavior (Defect)', ['1.1', '1.2']], ['Expected Behavior (Correct)', ['2.1']], ['Unchanged Behavior (Regression Prevention)', ['3.1']]])
  expect(b.items[0].criteria[0].steps).toEqual([{ key: 'WHEN', text: 'a loan is 36 hours late' }, { key: 'THEN', text: 'the system charges two days' }])
  expect(b.items[2].rest).toBe('A remark under the last group.')
})

test('requirements written the way the Kiro documentation shows them: EARS paragraphs under a ###', () => {
  const [b] = reqs(read('requirements', '## User Accounts\n\n### Sign up\n\nWHEN a visitor submits the form\nTHE SYSTEM SHALL create an account\n\nSome other line.\n').blocks)
  expect(b.items[0]).toMatchObject({ title: 'Sign up', rest: 'Some other line.' })
  expect(b.items[0].criteria[0].steps[1]).toEqual({ key: 'THEN', text: 'THE SYSTEM SHALL create an account' })
})

const TASKS = `# Implementation Plan

## Overview

Build search in three steps.

## Tasks

- [x] 1. Add the search index
  - [x] 1.1 Create the index table
    - one row per tool
    - _Requirements: 1.1_
  - [-] 1.2 Fill it from the catalog
  - [ ]* 1.3 Write a property test for the index
- [ ] 1b. Checkpoint: the index answers
- [ ] 2. Search page
  - [ ] 2.1 Add the search box
  - [x]* 2.2 Snapshot test

## Notes

Optional tasks are marked with a star.
`

test('Kiro tasks.md: top-level numbered tasks are phases, their sub-tasks the items; optional and in-progress marks read', () => {
  const doc = read('tasks', TASKS, '.kiro/specs/x/tasks.md')
  const ps = phases(doc.blocks)
  expect(ps.map((p) => p.title)).toEqual(['1. Add the search index', '1b. Checkpoint: the index answers', '2. Search page'])
  expect(ps[0].items.map((i) => [i.id, i.done, !!i.optional])).toEqual([['1.1', true, false], ['1.2', false, false], ['1.3', false, true]])
  expect(ps[0].items[0].notes).toBe('- one row per tool\n- _Requirements: 1.1_')
  expect(ps[1].items.map((i) => i.id)).toEqual(['1b']) // a task with no sub-tasks is the one item of its phase
  expect(ps[2].items.map((i) => [i.id, !!i.optional])).toEqual([['2.1', false], ['2.2', true]])
  expect(doc.blocks.map((b) => b.kind)).toEqual(['raw', 'raw', 'phase', 'phase', 'phase', 'raw']) // Overview, the Tasks heading, phases, Notes
})

test('cc-sdd tasks.md: sub-tasks written flat under their parent, (P) marks parallel work', () => {
  const ps = phases(read('tasks', '# Implementation Plan\n\n- [ ] 1. Foundation\n- [x] 1.1 (P) Set up the repo\n- [ ] 1.2 Add CI\n- [ ] 2. Search\n- [ ] 2.1 Index\n', '.kiro/specs/x/tasks.md').blocks)
  expect(ps.map((p) => [p.title, p.items.map((i) => i.id)])).toEqual([['1. Foundation', ['1.1', '1.2']], ['2. Search', ['2.1']]])
  expect(ps[0].items[0]).toMatchObject({ parallel: true, text: 'Set up the repo', done: true })
})

test('tasks without sub-tasks anywhere make one phase, even with no ## at all', () => {
  const doc = read('tasks', '# Implementation Plan\n\n- [x] 1. Create the store\n  - persist in local storage\n- [ ] 2. Add the toggle\n', '.kiro/specs/x/tasks.md')
  expect(doc.blocks.map((b) => b.kind)).toEqual(['phase'])
  const [p] = phases(doc.blocks)
  expect(p.title).toBe('Implementation Plan')
  expect(p.items.map((i) => [i.id, i.text, i.notes ?? null])).toEqual([['1', 'Create the store', '- persist in local storage'], ['2', 'Add the toggle', null]])
})

test('steering front matter becomes header fields; the body is read on', () => {
  const doc = read('context', '---\ninclusion: fileMatch\nfileMatchPattern: "components/**/*.tsx"\n- odd line\n---\n\n# Components\n\n## Rules\n\nUse function components.\n', '.kiro/steering/components.md')
  expect(doc.meta).toEqual([{ label: 'inclusion', value: '`fileMatch`' }, { label: 'fileMatchPattern', value: '`"components/**/*.tsx"`' }])
  expect(doc.title).toBe('Components')
  expect(doc.blocks).toEqual([{ kind: 'code', lang: 'yaml', text: '- odd line' }, { kind: 'raw', heading: 'Rules', depth: 2, markdown: 'Use function components.' }])
})

test('design.md: decisions and correctness properties become cards; other sections stay as written', () => {
  const doc = read('design', '# Design\n\n## Overview\n\nA search index.\n\n## Decisions\n\nTwo choices.\n\n### D1: SQLite FTS\n\nNo new service.\n\n### D2: Index on save\n\nAlways fresh.\n\n## Correctness Properties\n\n### Property 1: Every tool is findable\n\nx\n', '.kiro/specs/x/design.md')
  expect(doc.blocks.map((b) => [b.kind, 'heading' in b ? b.heading : null])).toEqual([
    ['raw', 'Overview'], ['raw', 'Decisions'], ['cards', 'Decisions'], ['cards', 'Correctness Properties']])
  expect(doc.blocks[2].kind === 'cards' && doc.blocks[2].items.map((c) => c.title)).toEqual(['D1: SQLite FTS', 'D2: Index on save'])
})

test('the kind of a file in a spec folder, and the stage of a spec', () => {
  expect(['requirements.md', 'bugfix.md', 'design.md', 'tasks.md', 'research.md'].map(specKindOf)).toEqual(['requirements', 'requirements', 'design', 'tasks', 'other'])
  expect(specStageOf({ tasks: { done: 3, total: 3 }, hasDesign: true })).toBe('done')
  expect(specStageOf({ tasks: { done: 1, total: 3 }, hasDesign: true })).toBe('implement')
  expect(specStageOf({ tasks: { done: 0, total: 3 }, hasDesign: true })).toBe('tasks')
  expect(specStageOf({ tasks: { done: 0, total: 0 }, hasDesign: true })).toBe('tasks')
  expect(specStageOf({ tasks: null, hasDesign: true })).toBe('design')
  expect(specStageOf({ tasks: null, hasDesign: false })).toBe('requirements')
})

test('scanKiro: steering shared with the foundation files first, specs with counts that leave optional tasks out', () => {
  const root = tmp()
  write(root, '.kiro/steering/api.md', '# API\n')
  write(root, '.kiro/steering/tech.md', '# Tech\n')
  write(root, '.kiro/steering/product.md', '# Product\n')
  write(root, '.kiro/settings/templates/x.md', '# not read\n')
  write(root, '.kiro/specs/search/requirements.md', REQUIREMENTS)
  write(root, '.kiro/specs/search/design.md', '# Design\n')
  write(root, '.kiro/specs/search/tasks.md', TASKS)
  write(root, '.kiro/specs/search/spec.json', '{}')
  write(root, '.kiro/specs/fix-fees/bugfix.md', '# Bugfix\n')
  write(root, '.kiro/specs/done-one/tasks.md', '- [x] 1. a\n- [ ]* 2. optional\n')
  const p = scanKiro(root, null)
  expect(p.format).toBe('kiro')
  expect(p.shared!.map((d) => d.path)).toEqual(['.kiro/steering/product.md', '.kiro/steering/tech.md', '.kiro/steering/api.md'])
  expect(p.features.map((f) => [f.id, f.stage, f.tasks])).toEqual([
    ['done-one', 'done', { done: 1, total: 1 }], ['fix-fees', 'requirements', null], ['search', 'implement', { done: 1, total: 4 }]])
  expect(p.features[2].docs.map((d) => d.kind)).toEqual(['requirements', 'design', 'tasks'])
})

test('isKiro: .kiro/specs or .kiro/steering, never through a symlink', () => {
  const root = tmp()
  write(root, '.kiro/settings/mcp.json', '{}')
  expect(isKiro(root)).toBe(false)
  fs.mkdirSync(path.join(root, '.kiro/steering'))
  expect(isKiro(root)).toBe(true)
  const linked = tmp()
  fs.symlinkSync(path.join(root, '.kiro'), path.join(linked, '.kiro'))
  expect(isKiro(linked)).toBe(false)
})

// ---------- review fixes: I1, I2 ----------

test('a task list nested under a plain bullet before the top-level tasks: every box is counted, none becomes a title', () => {
  const doc = read('tasks', '# Tasks\n\n## Phase 1\n\n### Build\n\n- **Done when**:\n  - [ ] first check still open\n  - [x] second check\n\n### Ship\n\n- [x] shipped\n', '.kiro/specs/x/tasks.md')
  const ps = phases(doc.blocks)
  expect(ps.flatMap((p) => p.items.map((i) => [i.text, i.done]))).toEqual([['first check still open', false], ['second check', true], ['shipped', true]])
  const root = tmp()
  write(root, '.kiro/specs/hidden-open/tasks.md', '## Phase 1\n\n- **Done when**:\n  - [ ] first check still open\n  - [x] second check\n- [x] top-level done\n')
  expect(scanKiro(root, null).features[0]).toMatchObject({ stage: 'implement', tasks: { done: 2, total: 3 } })
})

test('the optional mark escaped by a formatter (`- [ ]\\*`) is an optional task, in place', () => {
  const ps = phases(read('tasks', '# Tasks\n\n- [ ] 1. Build\n  - [x] 1.1 Code\n  - [ ]\\* 1.2 Property test\n  - [x]\\* 1.3 Unit test\n  - [ ] 1.4 Docs\n', '.kiro/specs/x/tasks.md').blocks)
  expect(ps[0].items.map((i) => [i.id, i.done, !!i.optional])).toEqual([['1.1', true, false], ['1.2', false, true], ['1.3', true, true], ['1.4', false, false]])
  expect(ps[0].rest).toBe('')
})

test('a required task whose sub-tasks are all optional counts itself, so the spec is not done while it is open', () => {
  const ps = phases(read('tasks', '# Tasks\n\n- [x] 7. Store\n- [ ] 8. Build the modal\n  - [ ]* 8.1 Snapshot test\n  - [ ]\\* 8.2 Property test\n', '.kiro/specs/x/tasks.md').blocks)
  expect(ps.map((p) => [p.title, p.items.map((i) => [i.id, !!i.optional])])).toEqual([
    ['7. Store', [['7', false]]], ['8. Build the modal', [['8', false], ['8.1', true], ['8.2', true]]]])
  const root = tmp()
  write(root, '.kiro/specs/modal/tasks.md', '- [x] 7. Store\n- [ ] 8. Build the modal\n  - [ ]* 8.1 Snapshot test\n')
  expect(scanKiro(root, null).features[0]).toMatchObject({ stage: 'implement', tasks: { done: 1, total: 2 } })
})
