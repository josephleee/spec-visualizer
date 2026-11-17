import { expect, test } from 'vitest'
import { parseSpec } from '../server/parsers.ts'

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
  expect(blocks.map((b) => b.kind)).toEqual(['stories', 'raw', 'idList', 'raw'])
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
