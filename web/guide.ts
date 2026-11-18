import type { Block, CheckItem, DocKind, Feature, Project } from '../server/types.ts'
import { STAGES, stageIndex, type StageKey } from './route.ts'

export const CMD = {
  constitution: '/speckit.constitution', specify: '/speckit.specify', clarify: '/speckit.clarify',
  plan: '/speckit.plan', tasks: '/speckit.tasks', implement: '/speckit.implement',
} as const

// The command typed at a stage. Done is reached, not typed.
export const stageCommand = (stage: StageKey): string | null => (stage === 'done' ? null : CMD[stage])

export const tasksLeft = (f: Feature) => (f.tasks ? f.tasks.total - f.tasks.done : 0)

// What to type next for one feature.
export function nextCommand(f: Feature): { cmd: string | null; left: number } {
  switch (f.stage) {
    case 'specify': return { cmd: f.openQuestions > 0 ? CMD.clarify : CMD.plan, left: 0 }
    case 'plan': return { cmd: CMD.tasks, left: 0 }
    case 'tasks': return { cmd: CMD.implement, left: tasksLeft(f) }
    case 'implement': return { cmd: CMD.implement, left: tasksLeft(f) }
    case 'done': return { cmd: null, left: 0 }
  }
}

export const busy = (f: Feature) => !!f.tasks && f.tasks.total > 0 && f.tasks.done < f.tasks.total

export type StageCount = { here: Feature[]; passed: number; live: boolean }
// Per stage: the features standing there, how many have gone past, and whether work is under way there.
export function stageCounts(p: Project): StageCount[] {
  return STAGES.map((_, i) => {
    const here = i === 0 ? [] : p.features.filter(f => stageIndex(f) === i)
    return { here, passed: p.features.filter(f => stageIndex(f) > i).length, live: here.some(busy) }
  })
}

export type StageGuide =
  | { kind: 'constitution' | 'first' | 'wait'; cmd: string }
  | { kind: 'new' | 'move'; cmd: string; n: number; clarify: number }
  | { kind: 'implement'; cmd: string; left: number }
// What to type for the features standing at a stage (the footer of a board card).
export function stageGuide(p: Project, stage: StageKey): StageGuide {
  const here = stageCounts(p)[STAGES.indexOf(stage)].here
  if (stage === 'constitution') return p.constitution ? { kind: 'first', cmd: CMD.specify } : { kind: 'constitution', cmd: CMD.constitution }
  if (stage === 'done') return { kind: 'new', cmd: CMD.specify, n: here.length, clarify: 0 }
  if (stage === 'implement') return here.length ? { kind: 'implement', cmd: CMD.implement, left: here.reduce((n, f) => n + tasksLeft(f), 0) } : { kind: 'wait', cmd: CMD.implement }
  const cmd = CMD[({ specify: 'plan', plan: 'tasks', tasks: 'implement' } as const)[stage]]
  if (!here.length) return { kind: 'wait', cmd }
  const clarify = stage === 'specify' ? here.filter(f => f.openQuestions > 0).length : 0
  return { kind: 'move', cmd: clarify === here.length ? CMD.clarify : cmd, n: here.length, clarify }
}

// The feature the project strip speaks for: the current one while unfinished, else the one in progress, else the furthest unfinished.
export function leadFeature(p: Project): Feature | null {
  const open = p.features.filter(f => f.stage !== 'done')
  return open.find(f => f.id === p.currentFeature) ?? open.find(busy) ?? [...open].sort((a, b) => stageIndex(b) - stageIndex(a))[0] ?? null
}

export type StripGuide =
  | { kind: 'constitution' | 'first' | 'new'; cmd: string }
  | { kind: 'feature'; cmd: string; feature: Feature; left: number }
// What the project strip says to type next: for the lead feature, or else how to start
// (the constitution when the project has nothing, the first feature, or a new feature when every one is finished).
export function stripGuide(p: Project): StripGuide {
  const lead = leadFeature(p)
  if (lead) { const next = nextCommand(lead); return { kind: 'feature', cmd: next.cmd ?? CMD.specify, feature: lead, left: next.left } }
  if (p.features.length) return { kind: 'new', cmd: CMD.specify }
  return p.constitution ? { kind: 'first', cmd: CMD.specify } : { kind: 'constitution', cmd: CMD.constitution }
}

// The command that writes a kind of document. A checklist is not part of the six-stage flow, so none is named for it.
export const creatingCommand = (kind: DocKind): string | null => (({
  constitution: CMD.constitution, spec: CMD.specify, plan: CMD.plan, research: CMD.plan, 'data-model': CMD.plan, quickstart: CMD.plan,
  contract: CMD.plan, tasks: CMD.tasks, checklist: null, other: null,
} satisfies Record<DocKind, string | null>)[kind])

// Why a feature has no document for a stage: it is not that far yet, or it is finished and just has no checklist.
export const missingWhy = (f: Feature, stage: StageKey): 'complete' | 'ahead' => (stage === 'done' && f.stage === 'done' ? 'complete' : 'ahead')

// How many features the principles bind: said on the constitution page only, and only when there are features.
export const boundFeatures = (p: Project, stage: StageKey | null): number | null => (stage === 'constitution' && p.features.length ? p.features.length : null)

// Whole percent, rounded down so a task left never reads 100%. Multiply first: 29 / 100 * 100 is 28.999… in floating point.
export const percent = (done: number, total: number) => (total ? Math.floor(done * 100 / total) : 0)

export function projectTotals(p: Project) {
  const done = p.features.reduce((n, f) => n + (f.tasks?.done ?? 0), 0)
  const total = p.features.reduce((n, f) => n + (f.tasks?.total ?? 0), 0)
  return { done, total, pct: percent(done, total), finished: p.features.filter(f => f.stage === 'done').length }
}

// ---------- aggregates the document forms draw ----------
type B<K extends Block['kind']> = Extract<Block, { kind: K }>
export const phasesOf = (blocks: Block[]) => blocks.filter((b): b is B<'phase'> => b.kind === 'phase')
export const doneCount = (items: CheckItem[]) => items.filter(i => i.done).length

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
  return new Set(phases.find(p => p.items.some(i => !i.done))?.items.filter(i => !i.done) ?? [])
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
