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

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { parseDoc } from '../server/parsers.ts'

const reference = unified().use(remarkParse).use(remarkGfm)
const shape = (ns: any[]): unknown => ns.map((n) => [n.type, n.position.start.offset, n.position.end.offset, n.value ?? null, shape(n.children ?? [])])
// Each section has a heading line in column 0 inside a fence, an HTML block and a comment: places a long document must not be cut at.
const tricky = (n: number, extra = '') => Array.from({ length: n }, (_, i) =>
  `## Section ${i}\n\nSome words about section ${i} to fill the page with text.\n\n\`\`\`sh\n# not a heading ${i}\nrun ${i}\n\`\`\`\n\n<div>\n# still html ${i}\n</div>\n\n<!--\n# hidden ${i}\n-->\n\n- item\n  ~~~\n# ends the list ${i}\n\n1. **Given** a, **When** b, **Then** c\n`).join('\n') + extra

test('a long document parsed in pieces gives the same nodes and offsets as one parse', () => {
  for (const src of [tricky(500), tricky(500, '\n```\n# an open fence to the end\n'), tricky(500, '\n[ref]: https://example.com\n')]) {
    expect(src.length).toBeGreaterThan(100_000)
    expect(shape(parse(src))).toEqual(shape(reference.parse(src).children))
  }
})

const stories = (n: number) => '# Spec\n\n## User Scenarios\n\n' + Array.from({ length: n }, (_, i) =>
  `### User Story ${i + 1} - Story ${i + 1} (Priority: P1)\n\nUsers do thing ${i}. <!-- note ${i} -->\n\n**Why this priority**: Value ${i}.\n\n**Acceptance Scenarios**:\n\n1. **Given** a ${i}, **When** b, **Then** c\n`).join('\n')
const best = (f: () => unknown) => Math.min(...[0, 1].map(() => { const t = performance.now(); f(); return performance.now() - t }))

// Linear work takes 4x the time for 4x the stories; before parsing in pieces this was about 7x.
test('parsing time grows in step with the number of stories', () => {
  const [small, big] = [750, 3000].map((n) => stories(n) + '\n') // distinct texts, so nothing is reused between runs
  const ref = { path: 'specs/1/spec.md', kind: 'spec' as const, hash: 'h' }
  const [a, b] = [small, big].map((src) => best(() => { parse(''); parseDoc(ref, src) }))
  expect(b / a).toBeLessThan(6)
}, 60_000)
