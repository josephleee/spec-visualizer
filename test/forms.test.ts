import { Fragment, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { Block, CheckItem, DocKind, Feature, ParsedDoc } from '../server/types.ts'
import { parseDoc } from '../server/parsers.ts'
import { DocMeta, DocTitle, renderDoc } from '../web/forms/render.tsx'
import type { FormCtx } from '../web/forms/types.ts'
import { translate } from '../web/i18n.ts'

// Every piece of document text carries its own token; a page that drops one fails by name.
function tokens() {
  const made: string[] = []
  let n = 0
  return { tok: (what: string) => { const s = `Tok${++n}${what}`; made.push(s); return s }, made }
}
const feature: Feature = { id: '001-x', stage: 'implement', docs: [], tasks: { done: 1, total: 4 }, openQuestions: 0 }

// Visible text only: a token that survives just in a tooltip or another attribute does not count as shown.
const visible = (html: string) => html.replace(/<[^>]*>/g, ' ')
const t: FormCtx['t'] = (k, ...a) => translate('en', k, ...a)
const page = (doc: ParsedDoc, kind: DocKind, progress: boolean) => visible(renderToStaticMarkup(createElement(Fragment, null,
  createElement(DocTitle, { doc }), createElement(DocMeta, { doc }), renderDoc(doc, kind, progress, { feature, t }))))

function check(kind: DocKind, progress: boolean, build: (tok: (w: string) => string) => Block[]) {
  const { tok, made } = tokens()
  const doc: ParsedDoc = { ref: { path: 'p', kind, hash: 'h' }, title: tok('Title'), meta: [{ label: tok('MetaLabel'), value: tok('MetaValue') }], blocks: build(tok) }
  const text = page(doc, kind, progress)
  expect(made.filter(s => !text.includes(s))).toEqual([])
}

// Parser and form together: markdown as spec-kit writes it, read by the server's parser, drawn by the page.
function checkSource(path: string, kind: DocKind, progress: boolean, write: (tok: (w: string) => string) => string) {
  const { tok, made } = tokens()
  const text = page(parseDoc({ path, kind, hash: 'h' }, write(tok)), kind, progress)
  expect(made.filter(s => !text.includes(s))).toEqual([])
}

const extras = (tok: (w: string) => string): Block[] => [
  { kind: 'raw', heading: tok('HeadOnly'), depth: 2, markdown: '' },
  { kind: 'raw', heading: tok('RawHead'), depth: 2, markdown: tok('RawBody') },
  { kind: 'raw', heading: tok('SubHead'), depth: 3, markdown: tok('SubBody') },
  { kind: 'raw', heading: null, depth: 0, markdown: tok('Preamble') },
  { kind: 'code', lang: tok('Lang'), text: tok('Code') },
]
const items = (tok: (w: string) => string): CheckItem[] => [
  { id: tok('IdDone'), done: true, parallel: true, story: tok('StoryA'), text: tok('DoneText') },
  { id: tok('IdOpen'), done: false, parallel: false, story: null, text: tok('OpenText') },
]
const phases = (tok: (w: string) => string): Block[] => [
  { kind: 'phase', title: tok('Phase1'), fields: [{ label: 'Goal', value: tok('Goal') }, { label: 'Goal', value: tok('Goal2') }, { label: tok('FieldLabel'), value: tok('FieldValue') }], items: items(tok), rest: tok('Rest1') },
  { kind: 'phase', title: tok('PhaseAllDone'), fields: [{ label: 'Purpose', value: tok('Purpose') }], items: [{ id: tok('Id3'), done: true, parallel: false, story: tok('StoryB'), text: tok('Text3') }], rest: tok('Rest2') },
  { kind: 'phase', title: tok('PhaseEmpty'), fields: [], items: [], rest: tok('Rest3') },
]
const stories = (tok: (w: string) => string): Block => ({ kind: 'stories', items: [
  { title: tok('Story'), priority: 'P1', narrative: tok('Narrative'), why: tok('Why'), test: tok('Test'), rest: tok('StoryRest'),
    scenarios: [{ given: `${tok('Given')}\n\nAnd ${tok('GivenAnd')}`, when: tok('When'), then: tok('Then') }] },
  { title: tok('Story2'), priority: null, narrative: null, why: null, test: null, rest: '', scenarios: [] },
] })
const decisions = (tok: (w: string) => string): Block => ({ kind: 'decisions', items: [{
  title: tok('Decision'), rest: tok('DecRest'), fields: [
    { label: 'Question', value: tok('Q') }, { label: 'Decision', value: tok('D1') }, { label: 'Rationale', value: tok('R1') },
    { label: 'Alternatives Considered', value: tok('A1') }, { label: 'Decision', value: tok('D2') }, { label: 'Rationale', value: tok('R2') },
    { label: tok('OtherLabel'), value: tok('OtherValue') }],
}, { title: tok('DecisionBare'), rest: '', fields: [{ label: 'Decision', value: tok('D3') }] }] })
const cards = (tok: (w: string) => string, heading: string): Block => ({ kind: 'cards', heading, items: [{ title: tok('Card'), markdown: tok('CardBody') }, { title: tok('CardLong'), markdown: tok('Long') + ' x'.repeat(400) }] })
const fields = (tok: (w: string) => string, extra: { label: string; value: string }[] = []): Block => ({ kind: 'fields', heading: tok('FieldsHead'), rest: tok('FieldsRest'), items: [{ label: tok('L'), value: tok('V') }, ...extra] })
const idList = (tok: (w: string) => string, prefix: string, n = 1): Block => ({ kind: 'idList', heading: tok('ListHead'), depth: 3, rest: tok('ListRest'), items: Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${tok('Id')}${i}`, text: tok('ItemText') })) })

test('constitution: nothing is dropped', () => check('constitution', false, tok => [
  cards(tok, tok('CardsHead')),
  fields(tok, [{ label: 'Version', value: tok('Ver') }, { label: 'Ratified', value: tok('Rat') }, { label: 'Last Amended', value: tok('Amd') },
    { label: 'Version', value: tok('Ver2') }, { label: 'Ratified', value: tok('Rat2') }, { label: 'Last Amended', value: tok('Amd2') }]),
  fields(tok), cards(tok, tok('CardsHead2')), ...extras(tok),
]))

test('spec: nothing is dropped', () => check('spec', false, tok => [
  stories(tok), idList(tok, 'FR', 8), idList(tok, 'FR'), idList(tok, 'SC', 2), idList(tok, 'FR', 0), stories(tok), ...extras(tok),
]))

test('plan: nothing is dropped', () => check('plan', false, tok => [
  { kind: 'raw', heading: 'Summary', depth: 2, markdown: tok('Summary') }, fields(tok), fields(tok),
  { kind: 'raw', heading: 'Constitution Check', depth: 2, markdown: tok('Check') },
  { kind: 'raw', heading: 'Project Structure', depth: 2, markdown: tok('Structure') }, ...extras(tok),
]))

test('research: nothing is dropped', () => check('research', false, tok => [decisions(tok), ...extras(tok), decisions(tok)]))

test('data-model: nothing is dropped', () => check('data-model', false, tok => [
  cards(tok, tok('CardsHead')), cards(tok, tok('CardsHead2')), { kind: 'raw', heading: 'Relationships', depth: 2, markdown: tok('Rel') }, ...extras(tok),
]))

test('quickstart: nothing is dropped', () => check('quickstart', false, tok => [...extras(tok), fields(tok)]))
test('tasks: nothing is dropped', () => check('tasks', false, tok => [...phases(tok), ...extras(tok)]))
test('implement: nothing is dropped', () => check('tasks', true, tok => [...phases(tok), ...extras(tok)]))
test('checklist: nothing is dropped', () => check('checklist', false, tok => [...phases(tok), ...extras(tok)]))

test('a document without the expected structure, and kinds without a form: nothing is dropped', () => {
  const every = (tok: (w: string) => string) => [...extras(tok), stories(tok), decisions(tok), cards(tok, tok('CardsHead')), fields(tok), idList(tok, 'FR'), ...phases(tok)]
  check('other', false, every)
  check('contract', false, tok => [{ kind: 'code', lang: tok('Lang'), text: tok('Code') }])
  for (const kind of ['constitution', 'spec', 'plan', 'research', 'data-model', 'tasks', 'checklist'] as const)
    check(kind, false, tok => [{ kind: 'raw', heading: tok('H'), depth: 2, markdown: tok('B') }, { kind: 'raw', heading: tok('Only'), depth: 2, markdown: '' }])
})

const head = (tok: (w: string) => string, what: string) => `# ${what}: ${tok('Title')}\n\n**Feature Branch**: \`${tok('Branch')}\`\n**Status**: ${tok('Status')}\n`
const tail = (tok: (w: string) => string) => `\n## ${tok('ExtraHead')}\n\n${tok('ExtraText')}\n\n| ${tok('Th')} | B |\n|---|---|\n| ${tok('Td')} | x |\n\n\`\`\`sh ${tok('Info')}\n${tok('Fenced')}\n\`\`\`\n\n## ${tok('BareHead')}\n`

test('constitution.md, parsed and drawn: nothing is dropped', () => checkSource('.specify/memory/constitution.md', 'constitution', false, tok => `# ${tok('Title')} Constitution

${tok('Preamble')}

## Core Principles

### I. ${tok('PrincipleA')}

${tok('BodyA')}

- ${tok('BulletA')}

### II. ${tok('PrincipleB')}

${tok('BodyB')}

## Technology Stack

**Language**: ${tok('Language')}
**Testing**: ${tok('Testing')}

${tok('StackRest')}

## Governance

${tok('GovText')}

**Version**: ${tok('Version')} | **Ratified**: ${tok('Ratified')} | **Last Amended**: ${tok('Amended')}
${tail(tok)}`))

test('spec.md in both story styles, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/spec.md', 'spec', false, tok => `${head(tok, 'Feature Specification')}
## User Scenarios & Testing

### User Story 1 - ${tok('StoryA')} (Priority: P1)

${tok('StoryText')}

**Why this priority**: ${tok('Why')}

**Independent Test**: ${tok('Test')}

**Acceptance Scenarios**:

1. **Given** ${tok('Given')}, **When** ${tok('When')}, **Then** ${tok('Then')}
2. **Given** ${tok('Given2')}, **When** ${tok('When2')}, **Then** ${tok('Then2')}

### US-2: ${tok('StoryB')}
**As a** ${tok('Role')}
**I want to** ${tok('Want')}
**So that** ${tok('Benefit')}

**Acceptance Criteria:**
- Given ${tok('GivenB')}
- And ${tok('AndGiven')}
- When ${tok('WhenB')}
- Then ${tok('ThenB')}
- But ${tok('ButThen')}
- ${tok('LooseItem')}

### Edge Cases

- ${tok('Edge')}

## Requirements

### Functional Requirements

- **FR-001**: ${tok('Fr1')}
- **FR-002**: ${tok('Fr2')} [NEEDS CLARIFICATION: ${tok('Question')}]

${tok('AfterList')}

### Key Entities

- **${tok('Entity')}**: ${tok('EntityText')}

## Success Criteria

### Measurable Outcomes

- **SC-001**: ${tok('Sc1')}
${tail(tok)}`))

test('plan.md, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/plan.md', 'plan', false, tok => `${head(tok, 'Implementation Plan')}
## Summary

${tok('Summary')}

## Technical Context

**Language/Version**: ${tok('Lang')}
**Storage**: ${tok('Storage')}

${tok('ContextRest')}

## Constitution Check

| Principle | Status |
|---|---|
| ${tok('Principle')} | ${tok('Pass')} |

## Project Structure

\`\`\`text
${tok('Tree')}/
\`\`\`

## Complexity Tracking

${tok('Complexity')}
${tail(tok)}`))

test('research.md, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/research.md', 'research', false, tok => `${head(tok, 'Research')}
## ${tok('Overview')}

${tok('OverviewText')}

## 1. ${tok('Topic')}

**Question**: ${tok('Question')}

**Decision**: ${tok('Decision')}

**Rationale**:
- ${tok('Reason')}

**Alternatives Considered**:
- ${tok('Alternative')}

${tok('Loose')}

## 2. ${tok('TopicB')}

**Decision**: ${tok('DecisionB')}

**Implementation**: ${tok('Implementation')}
${tail(tok)}`))

test('data-model.md, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/data-model.md', 'data-model', false, tok => `${head(tok, 'Data Model')}
## Entities

### 1. ${tok('EntityA')}

${tok('EntityAText')}

| Field | Type |
|---|---|
| ${tok('FieldName')} | ${tok('FieldType')} |

### 2. ${tok('EntityB')}

\`\`\`rust
struct ${tok('Struct')};
\`\`\`

## Relationships

${tok('Relationships')}

## State Transitions

${tok('States')}
${tail(tok)}`))

test('quickstart.md, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/quickstart.md', 'quickstart', false, tok => `${head(tok, 'Quickstart')}
${tok('Intro')}

## ${tok('StepA')}

1. ${tok('Do')}

### ${tok('SubStep')}

${tok('SubText')}

## ${tok('StepB')}

${tok('StepBText')}
${tail(tok)}`))

const tasksSource = (tok: (w: string) => string) => `${head(tok, 'Tasks')}
- [x] T000 ${tok('BeforeAnyPhase')}

## Format

${tok('Format')}

## Phase 1: ${tok('PhaseA')} ✅

**Purpose**: ${tok('Purpose')}

- [x] T001 ${tok('TaskDone')}
- [x] T002 [P] ${tok('TaskParallel')}

---

## Phase 2: ${tok('PhaseB')}

**Goal**: ${tok('Goal')}

**Independent Test**: ${tok('IndependentTest')}

### ${tok('SubHeading')}

${tok('Note')}

- [ ] T003 [P] [US1] ${tok('TaskOpen')}
- [x] T004a [US1] ${tok('TaskSuffix')}
  - ${tok('Nested')}

**Checkpoint**: ${tok('Checkpoint')}

## Dependencies

${tok('Dependencies')}
${tail(tok)}`
test('tasks.md at the tasks stage, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/tasks.md', 'tasks', false, tasksSource))
test('tasks.md at the implement stage, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/tasks.md', 'tasks', true, tasksSource))

test('a checklist, parsed and drawn: nothing is dropped', () => checkSource('specs/001-x/checklists/requirements.md', 'checklist', false, tok => `${head(tok, 'Checklist')}
## ${tok('GroupA')}

- [x] CHK001 ${tok('Checked')}
- [ ] ${tok('Unchecked')}

${tok('GroupNote')}

## Notes

- ${tok('Notes')}
${tail(tok)}`))

test('a contract and an unknown document, parsed and drawn: nothing is dropped', () => {
  checkSource('specs/001-x/contracts/api.yaml', 'contract', false, tok => `openapi: 3.0.0\ninfo: ${tok('Info')}\n`)
  checkSource('specs/001-x/notes.md', 'other', false, tok => `# ${tok('Title')}\n\n${tok('Intro')}\n${tail(tok)}`)
})
