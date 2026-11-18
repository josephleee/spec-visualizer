import { expect, test } from 'vitest'
import type { DocKind, Feature, Project, Stage } from '../server/types.ts'
import { defaultFeature, docHref, featureHref, formatRoute, parseRoute, resolveFeature, resolveTarget, stageDocKind, type Route, type StageRoute } from '../web/route.ts'

const feature = (id: string, stage: Stage, kinds: DocKind[]): Feature => ({
  id, stage, tasks: null, openQuestions: 0,
  docs: kinds.map((kind, i) => ({ path: `specs/${id}/${kind}${i}.md`, kind, hash: 'h' })),
})
const project = (features: Feature[], currentFeature: string | null = null) => ({ features, currentFeature } as Project)

test('routes survive a format and parse round trip', () => {
  const routes: Route[] = [
    { kind: 'board' },
    { kind: 'stage', stage: 'constitution', feature: null, sub: null },
    { kind: 'stage', stage: 'constitution', feature: '010-pager', sub: null }, // the chosen feature rides along
    { kind: 'stage', stage: 'specify', feature: null, sub: null },
    { kind: 'stage', stage: 'tasks', feature: '010-pager', sub: null },
    { kind: 'stage', stage: 'plan', feature: '010-pager', sub: 'data-model' },
    { kind: 'stage', stage: 'plan', feature: '010-pager', sub: 'contract' },
    { kind: 'stage', stage: 'done', feature: '기능 a/b#1 100%', sub: null },
    { kind: 'doc', path: 'specs/001-login/contracts/api v1.yaml' },
    { kind: 'doc', path: 'specs/한글/분석 #1.md' },
  ]
  for (const r of routes) expect(parseRoute(formatRoute(r))).toEqual(r)
})

test('the written forms of the addresses', () => {
  expect(formatRoute({ kind: 'board' })).toBe('#/')
  expect(formatRoute({ kind: 'stage', stage: 'plan', feature: '010-pager', sub: 'research' })).toBe('#/stage/plan/010-pager/research')
  expect(formatRoute({ kind: 'doc', path: 'specs/a/spec.md' })).toBe('#/doc/specs%2Fa%2Fspec.md')
})

test('a sub document belongs only to the plan stage and needs a feature', () => {
  expect(parseRoute('#/stage/tasks/010-pager/research')).toEqual({ kind: 'stage', stage: 'tasks', feature: '010-pager', sub: null })
  expect(parseRoute('#/stage/plan/010-pager/nope')).toEqual({ kind: 'stage', stage: 'plan', feature: '010-pager', sub: null })
  expect(formatRoute({ kind: 'stage', stage: 'plan', feature: null, sub: 'research' })).toBe('#/stage/plan')
  expect(parseRoute('#/stage/constitution/010-pager/research')).toEqual({ kind: 'stage', stage: 'constitution', feature: '010-pager', sub: null })
})

test('an unreadable address is the board', () => {
  for (const h of ['', '#', '#/', '#/stage', '#/stage/nope', '#/stage/plan/%E0%A4%A', '#/doc/%E0%A4%A', '#/other'])
    expect(parseRoute(h)).toEqual({ kind: 'board' })
})

test('each stage reads one kind of document', () => {
  expect(stageDocKind('constitution', null)).toBe('constitution')
  expect(stageDocKind('specify', null)).toBe('spec')
  expect(stageDocKind('plan', null)).toBe('plan')
  expect(stageDocKind('plan', 'quickstart')).toBe('quickstart')
  expect(stageDocKind('tasks', null)).toBe('tasks')
  expect(stageDocKind('implement', null)).toBe('tasks')
  expect(stageDocKind('done', null)).toBe('checklist')
})

test('without a feature in the address: the current feature when it has the document', () => {
  const p = project([feature('a', 'done', ['spec', 'plan', 'tasks']), feature('b', 'plan', ['spec', 'plan'])], 'b')
  expect(defaultFeature(p, 'plan')?.id).toBe('b')
  expect(defaultFeature(p, 'tasks')?.id).toBe('a') // b has no tasks.md
})

test('without a current feature: the most advanced feature that has the document', () => {
  const p = project([feature('a', 'specify', ['spec']), feature('b', 'implement', ['spec', 'tasks']), feature('c', 'done', ['spec', 'tasks']), feature('d', 'done', ['spec', 'tasks', 'checklist'])])
  expect(defaultFeature(p, 'spec')?.id).toBe('c') // ties keep project order
  expect(defaultFeature(p, 'checklist')?.id).toBe('d')
})

test('when no feature has the document, still name a feature so the page can say what is missing', () => {
  const p = project([feature('a', 'specify', ['spec']), feature('b', 'plan', ['spec', 'plan'])])
  expect(defaultFeature(p, 'checklist')?.id).toBe('b')
  expect(defaultFeature(project([feature('a', 'specify', ['spec'])], 'a'), 'tasks')?.id).toBe('a')
  expect(defaultFeature(project([]), 'spec')).toBeNull()
})

test('a feature id in the address is that feature or nobody; only a bare address gets the default', () => {
  const p = project([feature('a', 'specify', ['spec']), feature('b', 'plan', ['spec', 'plan'])])
  expect(resolveFeature(p, 'plan', 'a')?.id).toBe('a')
  expect(resolveFeature(p, 'plan', 'gone')).toBeNull() // deleted while its page was open
  expect(resolveFeature(p, 'plan', null)?.id).toBe('b')
})

test('an address resolves to its stage, feature and the documents of that kind', () => {
  const a = feature('a', 'done', ['spec', 'tasks', 'checklist', 'checklist', 'other'])
  const p = { ...project([a]), constitution: { path: 'c.md', kind: 'constitution', hash: 'h' } } as Project
  const stage = (s: string, f: string | null = null) => resolveTarget(p, parseRoute(`#/stage/${s}${f ? `/${f}` : ''}`) as StageRoute)
  expect(stage('constitution')).toEqual({ stage: 'constitution', feature: null, kind: 'constitution', refs: [p.constitution] })
  expect(stage('implement').refs).toEqual([a.docs[1]]) // implement reads tasks.md
  expect(stage('done', 'a').refs).toEqual([a.docs[2], a.docs[3]])
  expect(stage('plan', 'a')).toEqual({ stage: 'plan', feature: a, kind: 'plan', refs: [] }) // not written
  expect(stage('specify', 'gone')).toEqual({ stage: 'specify', feature: null, kind: 'spec', refs: [] })
  expect(resolveTarget(p, { kind: 'doc', path: a.docs[4].path })).toEqual({ stage: null, feature: a, kind: 'other', refs: [a.docs[4]] })
  expect(resolveTarget(p, { kind: 'doc', path: 'c.md' })).toEqual({ stage: null, feature: null, kind: 'constitution', refs: [p.constitution] })
  expect(resolveTarget(p, { kind: 'doc', path: 'nope.md' }).refs).toEqual([])
})

test('the constitution belongs to no feature, whichever one rides along in its address', () => {
  const p = { ...project([feature('a', 'specify', ['spec'])]), constitution: { path: 'c.md', kind: 'constitution', hash: 'h' } } as Project
  for (const f of ['a', 'gone', null]) expect(resolveTarget(p, { kind: 'stage', stage: 'constitution', feature: f, sub: null })).toEqual({ stage: 'constitution', feature: null, kind: 'constitution', refs: [p.constitution] })
})

test('switching feature keeps the plan document when the new feature has it', () => {
  const full = feature('a', 'plan', ['spec', 'plan', 'research']), bare = feature('b', 'plan', ['spec', 'plan'])
  expect(featureHref('plan', full, 'research')).toBe('#/stage/plan/a/research')
  expect(featureHref('plan', bare, 'research')).toBe('#/stage/plan/b')
  expect(featureHref('plan', full, null)).toBe('#/stage/plan/a')
  expect(featureHref('tasks', full, null)).toBe('#/stage/tasks/a')
})

test('a document opens on its stage page, or on the generic page when it has none', () => {
  const f = feature('a', 'done', ['spec', 'plan', 'research', 'tasks', 'checklist', 'checklist', 'contract', 'other'])
  const href = (i: number) => docHref(f, f.docs[i])
  expect(href(0)).toBe('#/stage/specify/a')
  expect(href(1)).toBe('#/stage/plan/a')
  expect(href(2)).toBe('#/stage/plan/a/research')
  expect(href(3)).toBe('#/stage/tasks/a')
  expect(href(4)).toBe('#/stage/done/a')
  expect(href(5)).toBe(`#/doc/${encodeURIComponent(f.docs[5].path)}`) // an extra checklist
  expect(href(6)).toBe('#/stage/plan/a/contract')
  expect(href(7)).toBe(`#/doc/${encodeURIComponent(f.docs[7].path)}`)
})
