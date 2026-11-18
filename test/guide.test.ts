import { expect, test } from 'vitest'
import type { Block, CheckItem, Feature, Project, Stage } from '../server/types.ts'
import { boundFeatures, busy, byStory, creatingCommand, missingWhy, percent, stripGuide, leadFeature, nextCommand, nextUp, projectTotals, specCounts, stageCommand, stageCounts, stageGuide, taskColumns } from '../web/guide.ts'

const feature = (id: string, stage: Stage, done = 0, total = 0, openQuestions = 0): Feature =>
  ({ id, stage, docs: [], tasks: total ? { done, total } : null, openQuestions })
const project = (features: Feature[], currentFeature: string | null = null) => ({ features, currentFeature } as Project)
const item = (id: string, done: boolean, parallel = false, story: string | null = null): CheckItem => ({ id, done, parallel, story, text: id })

test('the next command follows the stage of the feature', () => {
  expect(nextCommand(feature('a', 'specify'))).toEqual({ cmd: '/speckit.plan', left: 0 })
  expect(nextCommand(feature('a', 'specify', 0, 0, 2))).toEqual({ cmd: '/speckit.clarify', left: 0 })
  expect(nextCommand(feature('a', 'plan'))).toEqual({ cmd: '/speckit.tasks', left: 0 })
  expect(nextCommand(feature('a', 'tasks', 0, 8))).toEqual({ cmd: '/speckit.implement', left: 8 })
  expect(nextCommand(feature('a', 'implement', 51, 66))).toEqual({ cmd: '/speckit.implement', left: 15 })
  expect(nextCommand(feature('a', 'done', 42, 42))).toEqual({ cmd: null, left: 0 })
})

test('every stage but done has a command of its own', () => {
  expect(stageCommand('constitution')).toBe('/speckit.constitution')
  expect(stageCommand('implement')).toBe('/speckit.implement')
  expect(stageCommand('done')).toBeNull()
})

const p = project([
  feature('001', 'specify'), feature('002', 'specify', 0, 0, 1), feature('003', 'plan'),
  feature('009', 'done', 42, 42), feature('010', 'implement', 51, 66),
])

test('per stage: who stands here, how many went past, and where work is under way', () => {
  const c = stageCounts(p)
  expect(c.map(x => x.here.map(f => f.id))).toEqual([[], ['001', '002'], ['003'], [], ['010'], ['009']])
  expect(c.map(x => x.passed)).toEqual([5, 3, 2, 2, 1, 0])
  expect(c.map(x => x.live)).toEqual([false, false, false, false, true, false])
  expect(busy(feature('a', 'tasks', 0, 5))).toBe(true)
  expect(busy(feature('a', 'done', 5, 5))).toBe(false)
  expect(busy(feature('a', 'specify'))).toBe(false)
})

test('the card footer says what to type for the features standing there', () => {
  expect(stageGuide({ ...p, constitution: { path: 'c.md', kind: 'constitution', hash: 'h' } }, 'constitution')).toEqual({ kind: 'first', cmd: '/speckit.specify' })
  expect(stageGuide(p, 'constitution')).toEqual({ kind: 'constitution', cmd: '/speckit.constitution' }) // no constitution yet: write it first
  expect(stageGuide(p, 'specify')).toEqual({ kind: 'move', cmd: '/speckit.plan', n: 2, clarify: 1 })
  expect(stageGuide(p, 'plan')).toEqual({ kind: 'move', cmd: '/speckit.tasks', n: 1, clarify: 0 })
  expect(stageGuide(p, 'tasks')).toEqual({ kind: 'wait', cmd: '/speckit.implement' })
  expect(stageGuide(p, 'implement')).toEqual({ kind: 'implement', cmd: '/speckit.implement', left: 15 })
  expect(stageGuide(p, 'done')).toEqual({ kind: 'new', cmd: '/speckit.specify', n: 1, clarify: 0 })
  expect(stageGuide(project([feature('a', 'specify', 0, 0, 3)]), 'specify')).toEqual({ kind: 'move', cmd: '/speckit.clarify', n: 1, clarify: 1 })
  expect(stageGuide(project([]), 'implement')).toEqual({ kind: 'wait', cmd: '/speckit.implement' })
})

test('the strip speaks for the current feature, else the one in progress, else the furthest unfinished', () => {
  expect(leadFeature(p)?.id).toBe('010')
  expect(leadFeature(project(p.features, '001'))?.id).toBe('001')
  expect(leadFeature(project(p.features, '009'))?.id).toBe('010') // the current one is finished
  expect(leadFeature(project([feature('a', 'specify'), feature('b', 'plan')]))?.id).toBe('b')
  expect(leadFeature(project([feature('a', 'done', 1, 1)]))).toBeNull()
})

test('project totals count tasks across features', () => {
  expect(projectTotals(p)).toEqual({ done: 93, total: 108, pct: 86, finished: 1 })
  expect(projectTotals(project([]))).toEqual({ done: 0, total: 0, pct: 0, finished: 0 })
  expect(projectTotals(project([feature('a', 'implement', 199, 200)])).pct).toBe(99) // never 100% with a task left
  expect(projectTotals(project([feature('a', 'implement', 29, 100)])).pct).toBe(29) // 29 / 100 * 100 is 28.999… in floating point
  expect(percent(29, 100)).toBe(29)
  expect(percent(0, 0)).toBe(0)
})

test('consecutive parallel tasks share a column', () => {
  const items = [item('1', true), item('2', true, true), item('3', false, true), item('4', false), item('5', false, true)]
  expect(taskColumns(items).map(c => c.map(i => i.id))).toEqual([['1'], ['2', '3'], ['4'], ['5']])
  expect(taskColumns([])).toEqual([])
})

test('tasks group by story in order of first appearance', () => {
  const items = [item('1', true), item('2', true, false, 'US2'), item('3', false, false, 'US1'), item('4', false, false, 'US2'), item('5', false)]
  expect(byStory(items).map(g => [g.story, g.items.map(i => i.id), g.done])).toEqual([[null, ['1', '5'], 1], ['US2', ['2', '4'], 1], ['US1', ['3'], 0]])
})

test('next up is what is open in the first unfinished phase', () => {
  const a = [item('1', true), item('2', true)], b = [item('3', true), item('4', false), item('5', false)], c = [item('6', false)]
  expect([...nextUp([{ items: a }, { items: b }, { items: c }])].map(i => i.id)).toEqual(['4', '5'])
  expect(nextUp([{ items: a }]).size).toBe(0)
})

test('a spec is counted from its blocks', () => {
  const story = (priority: string | null, n: number) => ({ title: 't', priority, narrative: null, why: null, test: null, rest: '', scenarios: Array.from({ length: n }, () => ({ given: 'g', when: 'w', then: 't' })) })
  const list = (ids: string[]): Block => ({ kind: 'idList', heading: 'h', depth: 3, rest: '', items: ids.map(id => ({ id, text: id })) })
  const blocks: Block[] = [
    { kind: 'stories', items: [story('P1', 2), story('P2', 1), story('P1', 0)] },
    list(['FR-001', 'FR-002']), list(['FR-003']), list([]), list(['SC-001', 'SC-002', 'SC-003']),
    { kind: 'raw', heading: 'x', depth: 2, markdown: 'y' },
  ]
  const c = specCounts(blocks)
  expect([c.stories.length, c.nScenarios, c.nRequirements, c.nCriteria]).toEqual([3, 3, 3, 3])
  expect(c.requirements.length).toBe(2)
  expect(c.priorities).toEqual([{ priority: 'P1', n: 2 }, { priority: 'P2', n: 1 }])
  expect(specCounts([]).stories).toEqual([])
})

const constitution = { path: 'c.md', kind: 'constitution' as const, hash: 'h' }

test('the strip says what to type next for the whole project', () => {
  expect(stripGuide(project([]))).toEqual({ kind: 'constitution', cmd: '/speckit.constitution' })
  expect(stripGuide({ ...project([]), constitution })).toEqual({ kind: 'first', cmd: '/speckit.specify' })
  expect(stripGuide(p)).toEqual({ kind: 'feature', cmd: '/speckit.implement', feature: p.features[4], left: 15 })
  expect(stripGuide(project([feature('a', 'specify', 0, 0, 2)]))).toMatchObject({ kind: 'feature', cmd: '/speckit.clarify', left: 0 })
  // Everything finished: the same advice as the Done card.
  const finished = project([feature('a', 'done', 3, 3)])
  expect(stripGuide(finished)).toEqual({ kind: 'new', cmd: '/speckit.specify' })
  expect(stripGuide(finished).cmd).toBe(stageGuide(finished, 'done').cmd)
})

test('each kind of document is created by one command', () => {
  expect(creatingCommand('constitution')).toBe('/speckit.constitution')
  expect(creatingCommand('spec')).toBe('/speckit.specify')
  for (const k of ['plan', 'research', 'data-model', 'quickstart', 'contract'] as const) expect(creatingCommand(k)).toBe('/speckit.plan')
  expect(creatingCommand('tasks')).toBe('/speckit.tasks') // also on the implement page, which reads the same tasks.md
  expect(creatingCommand('checklist')).toBeNull()
  expect(creatingCommand('other')).toBeNull()
})

test('a missing document is either not reached yet, or a finished feature that simply has no checklist', () => {
  expect(missingWhy(feature('a', 'done', 3, 3), 'done')).toBe('complete')
  expect(missingWhy(feature('a', 'implement', 1, 3), 'done')).toBe('ahead')
  expect(missingWhy(feature('a', 'done', 3, 3), 'plan')).toBe('ahead')
})

test('the line about features following the principles belongs to the constitution page of a project with features', () => {
  expect(boundFeatures(p, 'constitution')).toBe(5)
  expect(boundFeatures(p, 'specify')).toBeNull()
  expect(boundFeatures(project([]), 'constitution')).toBeNull()
  expect(boundFeatures(p, null)).toBeNull()
})
