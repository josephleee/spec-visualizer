import { expect, test } from 'vitest'
import type { DocKind, DocRef, Feature, Project, Stage } from '../server/types.ts'
import { ALL_STAGES, FLOWS, SPEC_KIT, flowOf } from '../web/flows.ts'
import { creatingCommand, leadFeature, missingWhy, nextCommand, projectTotals, stageCommand, stageCounts, stageGuide, stripGuide } from '../web/guide.ts'
import { LABEL_KEYS, translate, translateFor, type LabelKey } from '../web/i18n.ts'
import { docHref, fitRoute, formatRoute, kindFile, linkFeature, parseRoute, resolveTarget, stageDocKind, type Route } from '../web/route.ts'
import { loadSeen } from '../web/seen.ts'

const ref = (path: string, kind: DocKind): DocRef => ({ path, kind, hash: 'h' })
const unit = (id: string, stage: Stage, kinds: DocKind[], done = 0, total = 0): Feature =>
  ({ id, stage, tasks: total ? { done, total } : kinds.includes('tasks') ? { done: 0, total: 0 } : null, openQuestions: 0, docs: kinds.map((k, i) => ref(`u/${id}/${k}${i}.md`, k)) })
const project = (format: 'openspec' | 'kiro', features: Feature[], shared: DocRef[] = [], currentFeature: string | null = null) =>
  ({ root: '/p', name: 'p', about: null, constitution: null, constitutionVersion: null, constitutionRatified: null, constitutionAmended: null, principles: [], currentFeature, features, format, shared } as Project)

const os = project('openspec', [
  unit('extend-hours', 'propose', ['proposal', 'delta']),
  unit('reminders', 'apply', ['proposal', 'delta', 'delta', 'design', 'tasks'], 3, 9),
  unit('retire-cards', 'apply', ['proposal', 'delta', 'tasks'], 3, 3),
  unit('archive/2026-05-12-search', 'archive', ['proposal', 'delta', 'tasks'], 6, 6),
], [ref('openspec/specs/loans/spec.md', 'capability'), ref('openspec/config.yaml', 'context')])
const kiro = project('kiro', [
  unit('waitlist', 'requirements', ['requirements']),
  unit('search', 'implement', ['requirements', 'design', 'tasks'], 3, 7),
  unit('signup', 'done', ['requirements', 'design', 'tasks'], 3, 3),
], [ref('.kiro/steering/product.md', 'context'), ref('.kiro/steering/tech.md', 'context')])

test('every format has a project stage first, then its unit stages, with a name in both languages', () => {
  expect(FLOWS['spec-kit'].stages.map(s => s.key)).toEqual(['constitution', 'specify', 'plan', 'tasks', 'implement', 'done'])
  expect(FLOWS.openspec.stages.map(s => s.key)).toEqual(['specs', 'propose', 'design', 'tasks', 'apply', 'archive'])
  expect(FLOWS.kiro.stages.map(s => s.key)).toEqual(['steering', 'requirements', 'design', 'tasks', 'implement', 'done'])
  for (const key of ALL_STAGES) for (const lang of ['en', 'ko'] as const) expect(translate(lang, `n.${key}` as LabelKey)).toBeTruthy()
  expect(flowOf({})).toBe(SPEC_KIT) // a project without a format is spec-kit
  expect(flowOf(os).id).toBe('openspec')
})

test('addresses: other formats\' stages and tabs parse, round trip, and fit only a project that has them', () => {
  const routes: Route[] = [
    { kind: 'stage', stage: 'specs', feature: null, sub: null },
    { kind: 'stage', stage: 'propose', feature: 'reminders', sub: 'delta' },
    { kind: 'stage', stage: 'apply', feature: 'archive/2026-05-12-search', sub: null },
    { kind: 'stage', stage: 'requirements', feature: 'search', sub: null },
  ]
  for (const r of routes) expect(parseRoute(formatRoute(r))).toEqual(r)
  expect(parseRoute('#/stage/design/x/delta')).toEqual({ kind: 'stage', stage: 'design', feature: 'x', sub: null }) // design has no tabs
  expect(fitRoute(parseRoute('#/stage/plan/001-x'), FLOWS.openspec)).toEqual({ kind: 'board' })
  expect(fitRoute(parseRoute('#/stage/propose/x/delta'), FLOWS.kiro)).toEqual({ kind: 'board' })
  expect(fitRoute(parseRoute('#/stage/plan/x/research'), SPEC_KIT)).toEqual({ kind: 'stage', stage: 'plan', feature: 'x', sub: 'research' })
  expect(fitRoute(parseRoute('#/stage/propose/x/delta'), FLOWS.openspec)).toEqual({ kind: 'stage', stage: 'propose', feature: 'x', sub: 'delta' })
  expect(fitRoute({ kind: 'doc', path: 'a.md' }, FLOWS.kiro)).toEqual({ kind: 'doc', path: 'a.md' })
})

test('each stage page reads its kind of document; the project stage offers every shared document of its kinds', () => {
  expect(stageDocKind('propose', null, FLOWS.openspec)).toBe('proposal')
  expect(stageDocKind('propose', 'delta', FLOWS.openspec)).toBe('delta')
  expect(stageDocKind('archive', null, FLOWS.openspec)).toBe('delta')
  expect(stageDocKind('done', null, FLOWS.kiro)).toBe('tasks')
  expect(stageDocKind('requirements', null, FLOWS.kiro)).toBe('requirements')
  const specs = resolveTarget(os, { kind: 'stage', stage: 'specs', feature: 'reminders', sub: null })
  expect(specs).toMatchObject({ stage: 'specs', feature: null, kind: 'capability' })
  expect(specs.refs.map(d => d.path)).toEqual(['openspec/specs/loans/spec.md', 'openspec/config.yaml'])
  expect(resolveTarget(kiro, { kind: 'stage', stage: 'steering', feature: null, sub: null }).refs).toHaveLength(2)
  expect(resolveTarget(os, { kind: 'stage', stage: 'propose', feature: 'reminders', sub: 'delta' }).refs).toHaveLength(2)
  expect(resolveTarget(os, { kind: 'doc', path: 'openspec/config.yaml' })).toMatchObject({ stage: null, feature: null, kind: 'context' })
  // Without a unit in the address: the most advanced one that has the document.
  expect(resolveTarget(os, { kind: 'stage', stage: 'archive', feature: null, sub: null }).feature?.id).toBe('archive/2026-05-12-search')
  expect(linkFeature(os, { kind: 'stage', stage: 'specs', feature: 'reminders', sub: null }, null)).toBe('reminders')
  expect(linkFeature(os, { kind: 'stage', stage: 'specs', feature: 'gone', sub: null }, null)).toBeNull()
})

test('a document opens on the stage where its unit stands when that stage shows it, else the first that does', () => {
  const r = os.features[1]
  expect(r.docs.map(d => docHref(r, d, FLOWS.openspec))).toEqual([
    '#/stage/propose/reminders', '#/stage/propose/reminders/delta', `#/doc/${encodeURIComponent('u/reminders/delta2.md')}`, '#/stage/design/reminders', '#/stage/apply/reminders'])
  const k = kiro.features[1]
  expect(k.docs.map(d => docHref(k, d, FLOWS.kiro))).toEqual(['#/stage/requirements/search', '#/stage/design/search', '#/stage/implement/search']) // tasks open where the spec stands
  expect(docHref(k, ref('x/notes.md', 'other'), FLOWS.kiro)).toBe(`#/doc/${encodeURIComponent('x/notes.md')}`)
})

test('file names follow the format', () => {
  expect(kindFile('context', FLOWS.openspec)).toBe('config.yaml, project.md')
  expect(kindFile('context', FLOWS.kiro)).toBe('steering/*.md')
  expect(kindFile('delta', FLOWS.openspec)).toBe('specs/*/spec.md')
  expect(kindFile('tasks', FLOWS.kiro)).toBe('tasks.md')
  expect(kindFile('plan')).toBe('plan.md')
})

test('OpenSpec: the next command names the change; a finished change is archived; the archive is the last stage', () => {
  const f = FLOWS.openspec
  expect(os.features.map(x => nextCommand(x, f))).toEqual([
    { cmd: '/openspec-continue-change extend-hours', left: 0 }, { cmd: '/openspec-apply-change reminders', left: 6 },
    { cmd: '/openspec-archive-change retire-cards', left: 0 }, { cmd: null, left: 0 }])
  expect(f.stages.map(s => stageCommand(s.key, f))).toEqual([null, '/openspec-propose', '/openspec-continue-change', '/openspec-continue-change', '/openspec-apply-change', '/openspec-archive-change'])
  expect(stageCounts(os).map(c => c.here.map(x => x.id))).toEqual([[], ['extend-hours'], [], [], ['reminders', 'retire-cards'], ['archive/2026-05-12-search']])
  expect(stageGuide(os, 'specs')).toEqual({ kind: 'first', cmd: '/openspec-propose' })
  expect(stageGuide(os, 'propose')).toEqual({ kind: 'move', cmd: '/openspec-continue-change', n: 1, clarify: 0 })
  expect(stageGuide(os, 'design')).toEqual({ kind: 'wait', cmd: '/openspec-continue-change' })
  expect(stageGuide(os, 'apply')).toEqual({ kind: 'implement', cmd: '/openspec-apply-change', left: 6 })
  expect(stageGuide(project('openspec', [os.features[2]]), 'apply')).toEqual({ kind: 'move', cmd: '/openspec-archive-change', n: 1, clarify: 0 })
  expect(stageGuide(os, 'archive')).toEqual({ kind: 'new', cmd: '/openspec-propose', n: 1, clarify: 0 })
  expect(leadFeature(os)?.id).toBe('reminders')
  expect(projectTotals(os)).toMatchObject({ finished: 1 })
  expect(creatingCommand('design', f)).toBe('/openspec-continue-change')
  expect(creatingCommand('context', f)).toBeNull()
  expect(missingWhy(os.features[3], 'archive', f)).toBe('complete')
  expect(missingWhy(os.features[2], 'archive', f)).toBe('ahead')
})

test('Kiro: the CLI command with the spec name; done has no command', () => {
  const f = FLOWS.kiro
  expect(kiro.features.map(x => nextCommand(x, f).cmd)).toEqual(['/spec waitlist', '/spec run search', null])
  expect(stageGuide(kiro, 'requirements')).toEqual({ kind: 'move', cmd: '/spec <name>', n: 1, clarify: 0 })
  expect(stageGuide(kiro, 'implement')).toEqual({ kind: 'implement', cmd: '/spec run <name>', left: 4 })
  expect(stageGuide(kiro, 'done')).toEqual({ kind: 'new', cmd: '/spec new <name>', n: 1, clarify: 0 })
  expect(creatingCommand('requirements', f, kiro.features[0])).toBe('/spec new <name>') // a new spec is named when it is made
  expect(creatingCommand('design', f, kiro.features[0])).toBe('/spec waitlist')
  expect(stageCommand('done', f)).toBeNull()
})

test('the strip: the lead unit, else how to start; no constitution step outside spec-kit', () => {
  expect(stripGuide(os)).toMatchObject({ kind: 'feature', cmd: '/openspec-apply-change reminders', left: 6 })
  expect(stripGuide(project('openspec', []))).toEqual({ kind: 'first', cmd: '/openspec-propose' })
  expect(stripGuide(project('kiro', [kiro.features[2]]))).toEqual({ kind: 'new', cmd: '/spec new <name>' })
})

test('each format\'s word for a unit replaces "feature" in every label, never inside a value', () => {
  for (const u of ['change', 'spec'] as const) for (const key of LABEL_KEYS) {
    expect(translateFor(u, 'en', key, 1, 2, 3, 4), key).not.toMatch(/\bfeatures?\b/i)
    expect(translateFor(u, 'ko', key, 1, 2, 3, 4), key).not.toMatch(/기능/)
  }
  expect(translateFor('change', 'en', 'g.move', 2, 'Design')).toBe('Moves 2 changes on to Design')
  expect(translateFor('spec', 'en', 'g.move', 1, 'Design')).toBe('Moves 1 spec on to Design')
  expect(translateFor('change', 'ko', 'g.move', 2, '설계')).toBe('변경 2개를 설계 단계로')
  expect(translateFor('spec', 'en', 'strip.left', 'add-feature-flags', 3)).toBe('add-feature-flags · 3 tasks left')
  for (const key of LABEL_KEYS) expect(translateFor('feature', 'en', key, 2, 'x')).toBe(translate('en', key, 2, 'x'))
})

test('a first open records the shared documents as seen too', () => {
  const store = new Map<string, string>()
  const seen = loadSeen(os, { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } as Storage)
  expect(seen['openspec/config.yaml']).toBe('h')
  expect(seen['openspec/specs/loans/spec.md']).toBe('h')
})
