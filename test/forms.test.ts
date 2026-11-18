import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { Block, CheckItem, DocKind, Feature, ParsedDoc } from '../server/types.ts'
import { renderDoc } from '../web/forms/render.tsx'
import { translate } from '../web/i18n.ts'

// Every piece of document text carries its own token; a page that drops one fails by name.
function tokens() {
  const made: string[] = []
  let n = 0
  return { tok: (what: string) => { const s = `Tok${++n}${what}`; made.push(s); return s }, made }
}
const feature: Feature = { id: '001-x', stage: 'implement', docs: [], tasks: { done: 1, total: 4 }, openQuestions: 0 }

function check(kind: DocKind, progress: boolean, build: (tok: (w: string) => string) => Block[]) {
  const { tok, made } = tokens()
  const doc: ParsedDoc = { ref: { path: 'p', kind, hash: 'h' }, title: 't', meta: [], blocks: build(tok) }
  const html = renderToStaticMarkup(renderDoc(doc, kind, progress, { feature, t: (k, ...a) => translate('en', k, ...a) }))
  expect(made.filter(s => !html.includes(s))).toEqual([])
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
