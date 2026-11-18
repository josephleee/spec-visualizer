import type { DocKind, DocRef, Feature, Project } from '../server/types.ts'
import { ALL_STAGES, SPEC_KIT, SUBS, flowOf, isProjectStage, stageDef, type Flow, type StageKey } from './flows.ts'

export type { StageKey } from './flows.ts'
// spec-kit's stages and plan documents, as before; other formats' stages are in flows.ts.
export const STAGES = SPEC_KIT.stages.map(s => s.key) as readonly StageKey[]
export const PLAN_SUBS = ['research', 'data-model', 'quickstart', 'contract'] as const
export type PlanSub = (typeof PLAN_SUBS)[number]

// sub: a tab of the stage page other than its lead document (a plan document, an OpenSpec delta spec).
export type StageRoute = { kind: 'stage'; stage: StageKey; feature: string | null; sub: DocKind | null }
export type Route = { kind: 'board' } | StageRoute | { kind: 'doc'; path: string }

const BOARD: Route = { kind: 'board' }
const isStage = (s: string): s is StageKey => (ALL_STAGES as string[]).includes(s)
const isSub = (stage: StageKey, s: string | undefined): s is DocKind => !!s && !!SUBS[stage]?.includes(s as DocKind)

// Anything unreadable (unknown stage, bad escape) is the board.
export function parseRoute(hash: string): Route {
  try {
    const doc = hash.match(/^#\/doc\/(.+)$/)
    if (doc) return { kind: 'doc', path: decodeURIComponent(doc[1]) }
    const [head, stage, feature, sub] = hash.replace(/^#\//, '').split('/').map(decodeURIComponent)
    if (head !== 'stage' || !stage || !isStage(stage)) return BOARD
    return { kind: 'stage', stage, feature: feature || null, sub: feature && isSub(stage, sub) ? sub : null }
  } catch { return BOARD }
}

export function formatRoute(r: Route): string {
  if (r.kind === 'board') return '#/'
  if (r.kind === 'doc') return `#/doc/${encodeURIComponent(r.path)}`
  return `#/stage/${r.stage}` + (r.feature ? `/${encodeURIComponent(r.feature)}` + (r.sub && isSub(r.stage, r.sub) ? `/${r.sub}` : '') : '')
}

// An address the format of this project cannot show (another format's stage or tab) is the board.
export function fitRoute(r: Route, flow: Flow): Route {
  if (r.kind !== 'stage') return r
  const def = stageDef(flow, r.stage)
  if (!def) return BOARD
  return r.sub && !def.kinds.slice(1).includes(r.sub) ? { ...r, sub: null } : r
}

export const stageHref = (stage: StageKey, feature?: string | null, sub?: DocKind | null) =>
  formatRoute({ kind: 'stage', stage, feature: feature ?? null, sub: sub ?? null })

// The document kind a stage page shows. spec-kit's tasks and implement read the same tasks.md.
export function stageDocKind(stage: StageKey, sub: DocKind | null, flow: Flow = SPEC_KIT): DocKind {
  const def = stageDef(flow, stage)
  return (sub && def?.kinds.includes(sub) ? sub : def?.kinds[0]) ?? 'other'
}

// How each kind of document is named on disk; a format that keeps a kind elsewhere says so in its flow.
export const KIND_FILE: Record<DocKind, string> = {
  constitution: 'constitution.md', spec: 'spec.md', plan: 'plan.md', research: 'research.md', 'data-model': 'data-model.md',
  quickstart: 'quickstart.md', contract: 'contracts/*', tasks: 'tasks.md', checklist: 'checklists/*.md', other: '*.md',
  capability: 'spec.md', delta: 'specs/*/spec.md', proposal: 'proposal.md', design: 'design.md', requirements: 'requirements.md', context: '*.md',
}
export const kindFile = (kind: DocKind, flow: Flow = SPEC_KIT) => flow.files[kind] ?? KIND_FILE[kind]

export const stageIndex = (f: Feature, flow: Flow = SPEC_KIT) => flow.stages.findIndex(s => s.key === f.stage)

// No feature in the address: the current feature when it has the document, else the most advanced feature that has it.
export function defaultFeature(p: Project, kind: DocKind): Feature | null {
  const flow = flowOf(p)
  const has = (f: Feature) => f.docs.some(d => d.kind === kind)
  const advanced = [...p.features].sort((a, b) => stageIndex(b, flow) - stageIndex(a, flow)) // stable: ties keep project order
  const cur = p.features.find(f => f.id === p.currentFeature)
  return (cur && has(cur) ? cur : advanced.find(has)) ?? cur ?? advanced[0] ?? null
}

// A feature named in the address is that feature or nobody (it may have been deleted); only a bare address gets the default.
export const resolveFeature = (p: Project, kind: DocKind, id: string | null): Feature | null =>
  id === null ? defaultFeature(p, kind) : p.features.find(f => f.id === id) ?? null

// The feature the stage links of a page carry. The project stage has none of its own, so the one that came
// in its address rides along, but only while it exists: a deleted feature must not ride on every link.
export function linkFeature(p: Project, r: Exclude<Route, { kind: 'board' }>, feature: Feature | null): string | null {
  if (feature) return feature.id
  return r.kind === 'stage' && isProjectStage(flowOf(p), r.stage) && p.features.some(f => f.id === r.feature) ? r.feature : null
}

// Switching to another feature on the same stage keeps the tab being read when that feature has it.
export const featureHref = (stage: StageKey, f: Feature, sub: DocKind | null) =>
  stageHref(stage, f.id, sub && f.docs.some(d => d.kind === sub) ? sub : null)

// Where a feature's document opens: its stage page when it has one, else the generic page.
export function docHref(feature: Feature, d: DocRef, flow: Flow = SPEC_KIT): string {
  const first = feature.docs.find(x => x.kind === d.kind) === d
  if (flow === SPEC_KIT) {
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
  // The first stage that shows this kind: as its lead document, or as a tab. A second document of a kind has no stage page.
  const def = flow.stages.slice(1).find(s => s.kinds.includes(d.kind))
  if (!def || !first) return formatRoute({ kind: 'doc', path: d.path })
  return stageHref(def.key, feature.id, def.kinds[0] === d.kind ? null : d.kind)
}

// The documents of the project stage: the constitution (spec-kit), or the shared documents of the kinds the stage shows.
export const projectDocs = (p: Project, kinds: DocKind[]): DocRef[] =>
  [...(p.constitution ? [p.constitution] : []), ...(p.shared ?? [])].filter(d => kinds.includes(d.kind))

export type Target = { stage: StageKey | null; feature: Feature | null; kind: DocKind; refs: DocRef[] }
// What a document address points at in this project: the stage, the feature, and the documents of that kind (none = not written, or gone).
export function resolveTarget(p: Project, r: StageRoute | { kind: 'doc'; path: string }): Target {
  if (r.kind === 'doc') {
    const feature = p.features.find(f => f.docs.some(d => d.path === r.path)) ?? null
    const ref = feature?.docs.find(d => d.path === r.path) ?? [...(p.constitution ? [p.constitution] : []), ...(p.shared ?? [])].find(d => d.path === r.path) ?? null
    return { stage: null, feature, kind: ref?.kind ?? 'other', refs: ref ? [ref] : [] }
  }
  const flow = flowOf(p)
  const kind = stageDocKind(r.stage, r.sub, flow)
  if (isProjectStage(flow, r.stage)) return { stage: r.stage, feature: null, kind, refs: projectDocs(p, stageDef(flow, r.stage)!.kinds) }
  const feature = resolveFeature(p, kind, r.feature)
  return { stage: r.stage, feature, kind, refs: feature?.docs.filter(d => d.kind === kind) ?? [] }
}
