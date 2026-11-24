// What the stage pages and the board say for OpenSpec and Kiro projects, rendered as the page renders them.
import { expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DocKind, Feature, ParsedDoc, Project, Stage } from '../server/types.ts'
import { Board } from '../web/Board.tsx'
import { StagePage } from '../web/StagePage.tsx'
import { FLOWS } from '../web/flows.ts'
import { stageCounts } from '../web/guide.ts'
import { docHref, parseRoute, resolveTarget } from '../web/route.ts'
import { implement } from '../web/forms/Implement.tsx'
import { translate } from '../web/i18n.ts'

const unit = (id: string, stage: Stage, kinds: DocKind[], done = 0, total = 0): Feature =>
  ({ id, stage, tasks: kinds.includes('tasks') ? { done, total } : null, openQuestions: 0, docs: kinds.map((k, i) => ({ path: `u/${id}/${k}${i}.md`, kind: k, hash: 'h' })) })
const project = (format: 'openspec' | 'kiro', features: Feature[]): Project =>
  ({ root: '/p', name: 'p', about: null, constitution: null, constitutionVersion: null, constitutionRatified: null, constitutionAmended: null, principles: [], currentFeature: null, features, format, shared: [] })
const visible = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
const page = (p: Project, hash: string, doc: ParsedDoc | null = null) => {
  const route = parseRoute(hash) as Exclude<ReturnType<typeof parseRoute>, { kind: 'board' }>
  const ref = resolveTarget(p, route).refs[0] ?? null
  const view = { route, entry: 'e', path: ref?.path ?? null, doc: ref ? doc : null, failed: false }
  return visible(renderToStaticMarkup(createElement(StagePage, { view, asked: route, project: p, seen: {}, onSeen: () => {}, onPick: () => {} })))
}

test('an archived OpenSpec change with no delta specs says so, without spec-kit\'s checklist wording', () => {
  const p = project('openspec', [unit('archive/2026-01-30-docs-only', 'archive', ['proposal', 'tasks'], 2, 2)])
  const text = page(p, '#/stage/archive/archive%2F2026-01-30-docs-only')
  expect(text).toContain('Archived without spec changes')
  expect(text).not.toMatch(/checklist/i)
})

test('a change that went past an optional document says it was skipped, not that it is still to be written', () => {
  const p = project('openspec', [unit('no-design', 'apply', ['proposal', 'delta', 'tasks'], 1, 3)])
  const text = page(p, '#/stage/design/no-design')
  expect(text).toContain('went past the Design stage without design.md')
  expect(text).not.toContain('has not been written')
})

test('the empty board names the first step of the format, not spec-kit\'s specification', () => {
  for (const [format, word] of [['openspec', 'propose the first change'], ['kiro', 'write the first requirements']] as const) {
    const text = visible(renderToStaticMarkup(createElement(Board, { project: project(format, []), seen: {} })))
    expect(text).toContain(word)
    expect(text).not.toContain('specification')
  }
})

test('archived changes with unticked tasks do not light the Archive card as in progress', () => {
  const p = project('openspec', [unit('archive/2026-01-01-old', 'archive', ['tasks'], 1, 3), unit('live', 'apply', ['tasks'], 1, 3)])
  expect(stageCounts(p).map((c) => c.live)).toEqual([false, false, false, false, true, false])
})

test('a document of an archived change opens on the stage where the change stands', () => {
  const f = unit('archive/2026-01-01-old', 'archive', ['proposal', 'delta', 'tasks'], 3, 3)
  expect(f.docs.map((d) => docHref(f, d, FLOWS.openspec))).toEqual([
    '#/stage/propose/archive%2F2026-01-01-old', '#/stage/archive/archive%2F2026-01-01-old', '#/stage/tasks/archive%2F2026-01-01-old'])
  const k = unit('done-spec', 'done', ['requirements', 'tasks'], 2, 2)
  expect(docHref(k, k.docs[1], FLOWS.kiro)).toBe('#/stage/done/done-spec')
})

test('progress outside spec-kit has no per-story section when no task names a story', () => {
  const doc: ParsedDoc = { ref: { path: 't.md', kind: 'tasks', hash: 'h' }, title: null, meta: [], blocks: [
    { kind: 'phase', title: '1. Build', fields: [], items: [{ id: '1.1', done: true, parallel: false, story: null, text: 'a' }, { id: '1.2', done: false, parallel: false, story: null, text: 'b' }], rest: '' }] }
  const t = (k: Parameters<typeof translate>[1], ...a: (string | number)[]) => translate('en', k, ...a)
  const html = (flow?: typeof FLOWS.kiro) => visible(renderToStaticMarkup(createElement('div', null, implement(doc, { feature: unit('s', 'implement', ['tasks'], 1, 2), t, flow })!.body)))
  expect(html(FLOWS.kiro)).not.toContain('Progress per story')
  expect(html()).toContain('Progress per story') // spec-kit as before
})

test('the first stage of a project with many capabilities offers them in one select, and its list numbers stay apart', () => {
  const shared = Array.from({ length: 14 }, (_, i) => ({ path: `openspec/specs/cap-${String(i).padStart(2, '0')}/spec.md`, kind: 'capability' as const, hash: 'h' }))
  const p = { ...project('openspec', []), shared: [...shared, { path: 'openspec/config.yaml', kind: 'context' as const, hash: 'h' }] }
  const html = renderToStaticMarkup(createElement(StagePage, { view: { route: parseRoute('#/stage/specs') as never, entry: 'e', path: shared[0].path, doc: null, failed: false }, asked: parseRoute('#/stage/specs'), project: p, seen: {}, onSeen: () => {}, onPick: () => {} }))
  expect(html).toContain('<select')
  expect(html.match(/<option /g)).toHaveLength(15)
  expect(html).not.toContain('aria-pressed')
  const board = renderToStaticMarkup(createElement(Board, { project: p, seen: {} }))
  expect(board).toContain('class="pr wide"')
  expect(visible(board)).toMatch(/config\.yaml ×1/) // one context file is named as itself
})

test('a short project-stage list keeps the old markup', () => {
  const p = { ...project('openspec', []), shared: [{ path: 'openspec/specs/a/spec.md', kind: 'capability' as const, hash: 'h' }] }
  expect(renderToStaticMarkup(createElement(Board, { project: p, seen: {} }))).toContain('class="pr"')
})

// ---------- re-review: N3 ----------

test('a Kiro spec past a stage without its document is not told the document is optional; OpenSpec\'s design.md is', () => {
  const kiro = project('kiro', [unit('capture', 'design', ['design'])])
  const text = page(kiro, '#/stage/requirements/capture')
  expect(text).toContain('went past the Requirements stage without requirements.md')
  expect(text).not.toMatch(/optional/i)
  const os = project('openspec', [unit('no-design', 'apply', ['proposal', 'delta', 'tasks'], 1, 3)])
  expect(page(os, '#/stage/design/no-design')).toMatch(/optional/)
  const os2 = project('openspec', [unit('no-proposal', 'design', ['design'])])
  expect(page(os2, '#/stage/propose/no-proposal')).not.toMatch(/optional/i) // proposal.md is not optional in OpenSpec
})
