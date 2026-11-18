import { expect, test } from 'vitest'
import { clean, parse, slice, splitAt, takeLabels, checkItems } from '../server/md.ts'

test('clean removes comments, BOM and CRLF but keeps comments in code', () => {
  const src = '\uFEFF# T\r\n<!-- note -->\r\ntext <!-- x --> more\r\n```\n<!-- keep -->\n```\n'
  const out = clean(src)
  expect(out).not.toContain('note')
  expect(out).not.toContain('<!-- x -->')
  expect(out).toContain('<!-- keep -->')
  expect(out).not.toContain('\r')
  expect(out.startsWith('# T')).toBe(true)
})

test('splitAt keeps every node and the preamble', () => {
  const src = 'intro\n\n## A\n\na1\n\n### A.1\n\nx\n\n## B\n\nb1\n'
  const secs = splitAt(parse(src), 2)
  expect(secs.map((s) => s.heading)).toEqual([null, 'A', 'B'])
  expect(slice(src, secs[1].nodes)).toContain('### A.1')
})

test('takeLabels splits label paragraphs and keeps the rest', () => {
  const src = 'before\n\n**Decision**: use which\n\n**Rationale**:\n\n- fast\n- small\n\n**Version**: 1.2.0 | **Ratified**: 2025-06-13\n'
  const { fields, rest } = takeLabels(src, parse(src))
  expect(fields.map((f) => f.label)).toEqual(['Decision', 'Rationale', 'Version', 'Ratified'])
  expect(fields[0].value).toBe('use which')
  expect(fields[1].value).toContain('- small')
  expect(fields[3].value).toBe('2025-06-13')
  expect(slice(src, rest)).toBe('before')
})

test('checkItems counts with or without an ID, uppercase X, and nested items', () => {
  const src = '- [x] T001 Create structure\n- [ ] T012 [P] [US1] Create model\n- [X] No implementation details\n  - [ ] nested\n- plain bullet\n'
  const items = checkItems(parse(src))
  expect(items).toHaveLength(4)
  expect(items[0]).toEqual({ id: 'T001', done: true, parallel: false, story: null, text: 'Create structure' })
  expect(items[1]).toMatchObject({ id: 'T012', done: false, parallel: true, story: 'US1', text: 'Create model' })
  expect(items[2]).toMatchObject({ id: null, done: true })
})

test('takeLabels reads line-start labels inside one paragraph', () => {
  const src = '**A**: x\n**B**: y\n'
  const { fields } = takeLabels(src, parse(src))
  expect(fields).toEqual([{ label: 'A', value: 'x' }, { label: 'B', value: 'y' }])
})

test('checkItems reads an ID with one lowercase letter suffix', () => {
  expect(checkItems(parse('- [ ] T006a [P] Do it\n'))[0]).toEqual({ id: 'T006a', done: false, parallel: true, story: null, text: 'Do it' })
})

test('takeLabels: a thematic break ends the value; text after it is kept in rest', () => {
  for (const hr of ['---', '***', '___']) {
    const src = `lead\n\n**Purpose**: Project initialization\n\n${hr}\n\nafter the break\n\n**Goal**: g\n\n${hr}\n`
    const { fields, rest } = takeLabels(src, parse(src))
    expect(fields).toEqual([{ label: 'Purpose', value: 'Project initialization' }, { label: 'Goal', value: 'g' }])
    expect(slice(src, rest)).toBe('lead\n\nafter the break')
  }
})

test('slice cuts each run of neighbouring nodes whole and joins the runs', () => {
  const src = 'a\nb\n\n- x\n\n- y\n\nmiddle\n\nz\n'
  const nodes = parse(src)
  expect(slice(src, nodes)).toBe(src.trim())
  expect(slice(src, [nodes[0], nodes[1], nodes[3]])).toBe('a\nb\n\n- x\n\n- y\n\nz')
})
