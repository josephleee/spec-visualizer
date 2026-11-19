import type { Block, CheckItem, DocKind, Feature, Project } from '../server/types.ts'
import { SPEC_KIT, finished, flowOf, isProjectStage, lastStage, stageDef, tasksLeft, type Flow, type StageGuide } from './flows.ts'
import { stageIndex, type StageKey } from './route.ts'

export { CMD, tasksLeft, type StageGuide } from './flows.ts'

// The command typed at a stage. spec-kit's done is reached, not typed.
export const stageCommand = (stage: StageKey, flow: Flow = SPEC_KIT): string | null => stageDef(flow, stage)?.cmd ?? null

// What to type next for one feature.
export const nextCommand = (f: Feature, flow: Flow = SPEC_KIT) => flow.next(f)

export const busy = (f: Feature) => !!f.tasks && f.tasks.total > 0 && f.tasks.done < f.tasks.total

export type StageCount = { here: Feature[]; passed: number; live: boolean }
// Per stage: the features standing there, how many have gone past, and whether work is under way there.
export function stageCounts(p: Project): StageCount[] {
  const flow = flowOf(p)
  return flow.stages.map((_, i) => {
    const here = i === 0 ? [] : p.features.filter(f => stageIndex(f, flow) === i)
    // An archived OpenSpec change may keep unticked tasks; work there is not under way. spec-kit's done features are never busy.
    return { here, passed: p.features.filter(f => stageIndex(f, flow) > i).length, live: here.some(f => busy(f) && !finished(flow, f)) }
  })
}

// What to type for the features standing at a stage (the footer of a board card).
export function stageGuide(p: Project, stage: StageKey): StageGuide {
  const flow = flowOf(p)
  return flow.guide(p, stage, stageCounts(p)[flow.stages.findIndex(s => s.key === stage)]?.here ?? [])
}

// The feature the project strip speaks for: the current one while unfinished, else the one in progress, else the furthest unfinished.
export function leadFeature(p: Project): Feature | null {
  const flow = flowOf(p)
  const open = p.features.filter(f => !finished(flow, f))
  return open.find(f => f.id === p.currentFeature) ?? open.find(busy) ?? [...open].sort((a, b) => stageIndex(b, flow) - stageIndex(a, flow))[0] ?? null
}

export type StripGuide =
  | { kind: 'constitution' | 'first' | 'new'; cmd: string }
  | { kind: 'feature'; cmd: string; feature: Feature; left: number }
// What the project strip says to type next: for the lead feature, or else how to start
// (the constitution when the project has nothing, the first feature, or a new feature when every one is finished).
export function stripGuide(p: Project): StripGuide {
  const flow = flowOf(p)
  const lead = leadFeature(p)
  if (lead) { const next = flow.next(lead); return { kind: 'feature', cmd: next.cmd ?? flow.start, feature: lead, left: next.left } }
  if (p.features.length) return { kind: 'new', cmd: flow.start }
  return p.constitution || !flow.setup ? { kind: 'first', cmd: flow.start } : { kind: 'constitution', cmd: flow.setup }
}

// The command that writes a kind of document, for this feature where the command names it.
export const creatingCommand = (kind: DocKind, flow: Flow = SPEC_KIT, f: Feature | null = null): string | null => flow.making(kind, f)

// Why a feature has no document for a stage: it is not that far yet, it is finished and just has no document there, or
// (outside spec-kit, where design and the like are optional) it went past the stage without that document.
export function missingWhy(f: Feature, stage: StageKey, flow: Flow = SPEC_KIT): 'complete' | 'ahead' | 'skipped' {
  if (stage === lastStage(flow) && finished(flow, f)) return 'complete'
  return flow !== SPEC_KIT && stageIndex(f, flow) > flow.stages.findIndex(s => s.key === stage) ? 'skipped' : 'ahead'
}

// How many features the principles bind: said on the constitution page only, and only when there are features.
export const boundFeatures = (p: Project, stage: StageKey | null): number | null =>
  (stage === 'constitution' && isProjectStage(flowOf(p), stage) && p.features.length ? p.features.length : null)

// Whole percent, rounded down so a task left never reads 100%. Multiply first: 29 / 100 * 100 is 28.999… in floating point.
export const percent = (done: number, total: number) => (total ? Math.floor(done * 100 / total) : 0)

export function projectTotals(p: Project) {
  const done = p.features.reduce((n, f) => n + (f.tasks?.done ?? 0), 0)
  const total = p.features.reduce((n, f) => n + (f.tasks?.total ?? 0), 0)
  const flow = flowOf(p)
  return { done, total, pct: percent(done, total), finished: p.features.filter(f => finished(flow, f)).length }
}

// ---------- aggregates the document forms draw ----------
type B<K extends Block['kind']> = Extract<Block, { kind: K }>
export const phasesOf = (blocks: Block[]) => blocks.filter((b): b is B<'phase'> => b.kind === 'phase')
export const doneCount = (items: CheckItem[]) => items.filter(i => i.done).length
// The tasks that count: Kiro's optional ones (`[ ]*`) are shown but not counted. spec-kit has none.
export const required = (items: CheckItem[]) => items.filter(i => !i.optional)

// Consecutive [P] tasks stand in one column: they can run together.
export function taskColumns(items: CheckItem[]): CheckItem[][] {
  const cols: CheckItem[][] = []
  for (const it of items) {
    const last = cols[cols.length - 1]
    if (it.parallel && last?.[0].parallel) last.push(it)
    else cols.push([it])
  }
  return cols
}

// Tasks grouped by story tag in order of first appearance; untagged tasks form the null group.
export function byStory(items: CheckItem[]): { story: string | null; items: CheckItem[]; done: number }[] {
  const groups = new Map<string | null, CheckItem[]>()
  for (const it of items) groups.set(it.story, [...(groups.get(it.story) ?? []), it])
  return [...groups].map(([story, list]) => ({ story, items: list, done: doneCount(list) }))
}

// The open tasks of the first phase that still has any: what is next or in progress.
export function nextUp(phases: { items: CheckItem[] }[]): Set<CheckItem> {
  return new Set(phases.find(p => required(p.items).some(i => !i.done))?.items.filter(i => !i.done && !i.optional) ?? [])
}

export function specCounts(blocks: Block[]) {
  const stories = blocks.filter((b): b is B<'stories'> => b.kind === 'stories').flatMap(b => b.items)
  const lists = blocks.filter((b): b is B<'idList'> => b.kind === 'idList' && b.items.length > 0)
  const criteria = lists.filter(b => /^SC/i.test(b.items[0].id))
  const requirements = lists.filter(b => !criteria.includes(b))
  const n = (bs: B<'idList'>[]) => bs.reduce((s, b) => s + b.items.length, 0)
  const priorities = [...new Set(stories.map(s => s.priority).filter((x): x is string => !!x))].sort()
    .map(p => ({ priority: p, n: stories.filter(s => s.priority === p).length }))
  return {
    stories, requirements, criteria, priorities,
    nScenarios: stories.reduce((s, x) => s + x.scenarios.length, 0), nRequirements: n(requirements), nCriteria: n(criteria),
  }
}
