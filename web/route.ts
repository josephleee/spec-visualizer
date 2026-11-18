import type { DocKind, DocRef, Feature, Project } from '../server/types.ts'

export const STAGES = ['constitution', 'specify', 'plan', 'tasks', 'implement', 'done'] as const
export type StageKey = (typeof STAGES)[number]
export const PLAN_SUBS = ['research', 'data-model', 'quickstart', 'contract'] as const
export type PlanSub = (typeof PLAN_SUBS)[number]

export type StageRoute = { kind: 'stage'; stage: StageKey; feature: string | null; sub: PlanSub | null }
export type Route = { kind: 'board' } | StageRoute | { kind: 'doc'; path: string }

const BOARD: Route = { kind: 'board' }
const isStage = (s: string): s is StageKey => (STAGES as readonly string[]).includes(s)
const isSub = (s: string | undefined): s is PlanSub => !!s && (PLAN_SUBS as readonly string[]).includes(s)

// Anything unreadable (unknown stage, bad escape) is the board.
export function parseRoute(hash: string): Route {
  try {
    const doc = hash.match(/^#\/doc\/(.+)$/)
    if (doc) return { kind: 'doc', path: decodeURIComponent(doc[1]) }
    const [head, stage, feature, sub] = hash.replace(/^#\//, '').split('/').map(decodeURIComponent)
    if (head !== 'stage' || !stage || !isStage(stage)) return BOARD
    return { kind: 'stage', stage, feature: feature || null, sub: stage === 'plan' && feature && isSub(sub) ? sub : null }
  } catch { return BOARD }
}

export function formatRoute(r: Route): string {
  if (r.kind === 'board') return '#/'
  if (r.kind === 'doc') return `#/doc/${encodeURIComponent(r.path)}`
  return `#/stage/${r.stage}` + (r.feature ? `/${encodeURIComponent(r.feature)}` + (r.stage === 'plan' && r.sub ? `/${r.sub}` : '') : '')
}

export const stageHref = (stage: StageKey, feature?: string | null, sub?: PlanSub | null) =>
  formatRoute({ kind: 'stage', stage, feature: feature ?? null, sub: sub ?? null })

// The document kind a stage page shows. Tasks and implement read the same tasks.md.
export function stageDocKind(stage: StageKey, sub: PlanSub | null): DocKind {
  if (stage === 'plan') return sub ?? 'plan'
  return ({ constitution: 'constitution', specify: 'spec', tasks: 'tasks', implement: 'tasks', done: 'checklist' } as const)[stage]
}

// How each kind of document is named on disk.
export const KIND_FILE: Record<DocKind, string> = {
  constitution: 'constitution.md', spec: 'spec.md', plan: 'plan.md', research: 'research.md', 'data-model': 'data-model.md',
  quickstart: 'quickstart.md', contract: 'contracts/*', tasks: 'tasks.md', checklist: 'checklists/*.md', other: '*.md',
}

export const stageIndex = (f: Feature) => STAGES.indexOf(f.stage)

// No feature in the address: the current feature when it has the document, else the most advanced feature that has it.
export function defaultFeature(p: Project, kind: DocKind): Feature | null {
  const has = (f: Feature) => f.docs.some(d => d.kind === kind)
  const advanced = [...p.features].sort((a, b) => stageIndex(b) - stageIndex(a)) // stable: ties keep project order
  const cur = p.features.find(f => f.id === p.currentFeature)
  return (cur && has(cur) ? cur : advanced.find(has)) ?? cur ?? advanced[0] ?? null
}

// A feature named in the address is that feature or nobody (it may have been deleted); only a bare address gets the default.
export const resolveFeature = (p: Project, kind: DocKind, id: string | null): Feature | null =>
  id === null ? defaultFeature(p, kind) : p.features.find(f => f.id === id) ?? null

// The feature the stage links of a page carry. The constitution page has none of its own, so the one that came
// in its address rides along, but only while it exists: a deleted feature must not ride on every link.
export function linkFeature(p: Project, r: Exclude<Route, { kind: 'board' }>, feature: Feature | null): string | null {
  if (feature) return feature.id
  return r.kind === 'stage' && r.stage === 'constitution' && p.features.some(f => f.id === r.feature) ? r.feature : null
}

// Switching to another feature on the same stage keeps the plan document being read when that feature has it.
export const featureHref = (stage: StageKey, f: Feature, sub: PlanSub | null) =>
  stageHref(stage, f.id, sub && f.docs.some(d => d.kind === sub) ? sub : null)

// Where a feature's document opens: its stage page when it has one, else the generic page.
export function docHref(feature: Feature, d: DocRef): string {
  const first = feature.docs.find(x => x.kind === d.kind) === d
  switch (d.kind) {
    case 'spec': return stageHref('specify', feature.id)
    case 'plan': return stageHref('plan', feature.id)
    case 'tasks': return stageHref('tasks', feature.id)
    case 'research': case 'data-model': case 'quickstart': return stageHref('plan', feature.id, d.kind)
    case 'checklist': return first ? stageHref('done', feature.id) : formatRoute({ kind: 'doc', path: d.path })
    case 'contract': return first ? stageHref('plan', feature.id, 'contract') : formatRoute({ kind: 'doc', path: d.path })
    default: return formatRoute({ kind: 'doc', path: d.path })
  }
}

export type Target = { stage: StageKey | null; feature: Feature | null; kind: DocKind; refs: DocRef[] }
// What a document address points at in this project: the stage, the feature, and the documents of that kind (none = not written, or gone).
export function resolveTarget(p: Project, r: StageRoute | { kind: 'doc'; path: string }): Target {
  if (r.kind === 'doc') {
    const feature = p.features.find(f => f.docs.some(d => d.path === r.path)) ?? null
    const ref = feature?.docs.find(d => d.path === r.path) ?? (p.constitution?.path === r.path ? p.constitution : null)
    return { stage: null, feature, kind: ref?.kind ?? 'other', refs: ref ? [ref] : [] }
  }
  const kind = stageDocKind(r.stage, r.sub)
  if (r.stage === 'constitution') return { stage: r.stage, feature: null, kind, refs: p.constitution ? [p.constitution] : [] }
  const feature = resolveFeature(p, kind, r.feature)
  return { stage: r.stage, feature, kind, refs: feature?.docs.filter(d => d.kind === kind) ?? [] }
}
