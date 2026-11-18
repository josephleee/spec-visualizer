// What the page knows about each format: its stages and their documents, its commands, its word for a unit of work.
// The spec-kit flow holds exactly what the page assumed before other formats were read.
import type { DocKind, Feature, FormatId, Project, Stage } from '../server/types.ts'
import type { LabelKey } from './i18n.ts'

export type StageKey = 'constitution' | 'specs' | 'steering' | Stage
export type Unit = 'feature' | 'change' | 'spec'
// kinds[0] is what the stage page shows; more kinds are tabs (spec-kit plan, OpenSpec propose), or, on the project
// stage, documents the chooser offers.
export type StageDef = { key: StageKey; kinds: DocKind[]; cmd: string | null; progress?: true; note?: LabelKey }

export type StageGuide =
  | { kind: 'constitution' | 'first' | 'wait'; cmd: string }
  | { kind: 'new' | 'move'; cmd: string; n: number; clarify: number }
  | { kind: 'implement'; cmd: string; left: number }

export type Flow = {
  id: FormatId
  stages: StageDef[]                        // stages[0] is the project stage: documents of the whole project
  unit: Unit
  start: string                             // starts a new unit
  setup: string | null                      // writes the project stage's document when the project has none
  clarify: string | null                    // spec-kit's clarify: asked first when a unit has open questions
  files: Partial<Record<DocKind, string>>   // where this format keeps a kind, where KIND_FILE does not say it
  labels: { items: LabelKey; none: LabelKey; empty: LabelKey; noShared: LabelKey }
  next(f: Feature): { cmd: string | null; left: number }
  making(kind: DocKind, f: Feature | null): string | null
  guide(p: Project, stage: StageKey, here: Feature[]): StageGuide
}

export const tasksLeft = (f: Feature) => (f.tasks ? f.tasks.total - f.tasks.done : 0)

// ---------- spec-kit ----------

export const CMD = {
  constitution: '/speckit.constitution', specify: '/speckit.specify', clarify: '/speckit.clarify',
  plan: '/speckit.plan', tasks: '/speckit.tasks', implement: '/speckit.implement',
} as const

const SPEC_KIT: Flow = {
  id: 'spec-kit',
  stages: [
    { key: 'constitution', kinds: ['constitution'], cmd: CMD.constitution },
    { key: 'specify', kinds: ['spec'], cmd: CMD.specify },
    { key: 'plan', kinds: ['plan', 'research', 'data-model', 'quickstart', 'contract'], cmd: CMD.plan, note: 'p.note' },
    { key: 'tasks', kinds: ['tasks'], cmd: CMD.tasks },
    { key: 'implement', kinds: ['tasks'], cmd: CMD.implement, progress: true },
    { key: 'done', kinds: ['checklist'], cmd: null },
  ],
  unit: 'feature', start: CMD.specify, setup: CMD.constitution, clarify: CMD.clarify, files: {},
  labels: { items: 'principles', none: 'pr.none', empty: 'e.project.say', noShared: 'e.constitution' },
  next(f) {
    switch (f.stage) {
      case 'specify': return { cmd: f.openQuestions > 0 ? CMD.clarify : CMD.plan, left: 0 }
      case 'plan': return { cmd: CMD.tasks, left: 0 }
      case 'tasks': case 'implement': return { cmd: CMD.implement, left: tasksLeft(f) }
      default: return { cmd: null, left: 0 }
    }
  },
  // A checklist is not part of the six-stage flow, so no command is named for it.
  making: (kind) => (({
    constitution: CMD.constitution, spec: CMD.specify, plan: CMD.plan, research: CMD.plan, 'data-model': CMD.plan, quickstart: CMD.plan,
    contract: CMD.plan, tasks: CMD.tasks,
  }) as Partial<Record<DocKind, string>>)[kind] ?? null,
  guide(p, stage, here) {
    if (stage === 'constitution') return p.constitution ? { kind: 'first', cmd: CMD.specify } : { kind: 'constitution', cmd: CMD.constitution }
    if (stage === 'done') return { kind: 'new', cmd: CMD.specify, n: here.length, clarify: 0 }
    if (stage === 'implement') return here.length ? { kind: 'implement', cmd: CMD.implement, left: here.reduce((n, f) => n + tasksLeft(f), 0) } : { kind: 'wait', cmd: CMD.implement }
    const cmd = CMD[({ specify: 'plan', plan: 'tasks', tasks: 'implement' } as const)[stage as 'specify' | 'plan' | 'tasks']]
    if (!here.length) return { kind: 'wait', cmd }
    const clarify = stage === 'specify' ? here.filter(f => f.openQuestions > 0).length : 0
    return { kind: 'move', cmd: clarify === here.length ? CMD.clarify : cmd, n: here.length, clarify }
  },
}

// Moving the units at a stage on: the command for the next step, or the progress command where tasks are being done.
function moving(flow: { stages: StageDef[] }, stage: StageKey, here: Feature[], next: string, work: string): StageGuide {
  const def = flow.stages.find(s => s.key === stage)
  if (def?.progress) {
    const left = here.reduce((n, f) => n + tasksLeft(f), 0)
    if (!here.length) return { kind: 'wait', cmd: work }
    return left > 0 ? { kind: 'implement', cmd: work, left } : { kind: 'move', cmd: next, n: here.length, clarify: 0 }
  }
  return here.length ? { kind: 'move', cmd: next, n: here.length, clarify: 0 } : { kind: 'wait', cmd: next }
}

// ---------- OpenSpec (2.x skills, as typed in Claude Code) ----------

const OS = { propose: '/openspec-propose', continue: '/openspec-continue-change', apply: '/openspec-apply-change', archive: '/openspec-archive-change' } as const
const named = (cmd: string, f: Feature) => `${cmd} ${f.id}`

const OPENSPEC: Flow = {
  id: 'openspec',
  stages: [
    { key: 'specs', kinds: ['capability', 'context'], cmd: null },
    { key: 'propose', kinds: ['proposal', 'delta'], cmd: OS.propose, note: 'p.note.propose' },
    { key: 'design', kinds: ['design'], cmd: OS.continue },
    { key: 'tasks', kinds: ['tasks'], cmd: OS.continue },
    { key: 'apply', kinds: ['tasks'], cmd: OS.apply, progress: true },
    { key: 'archive', kinds: ['delta'], cmd: OS.archive },
  ],
  unit: 'change', start: OS.propose, setup: null, clarify: null,
  files: { capability: 'specs/*/spec.md', delta: 'specs/*/spec.md', context: 'config.yaml' },
  labels: { items: 'pr.caps', none: 'pr.caps.none', empty: 'e.project.os', noShared: 'e.shared.os' },
  next(f) {
    switch (f.stage) {
      case 'propose': case 'design': return { cmd: named(OS.continue, f), left: 0 }
      case 'tasks': return { cmd: named(OS.apply, f), left: tasksLeft(f) }
      // Every task ticked: archiving merges the change's specs and is a step of its own.
      case 'apply': return { cmd: named(tasksLeft(f) > 0 ? OS.apply : OS.archive, f), left: tasksLeft(f) }
      default: return { cmd: null, left: 0 }
    }
  },
  making: (kind) => (({ proposal: OS.propose, delta: OS.propose, design: OS.continue, tasks: OS.continue, capability: OS.archive }) as Partial<Record<DocKind, string>>)[kind] ?? null,
  guide(_p, stage, here) {
    switch (stage) {
      case 'specs': return { kind: 'first', cmd: OS.propose }
      case 'propose': case 'design': return moving(this, stage, here, OS.continue, OS.continue)
      case 'tasks': return moving(this, stage, here, OS.apply, OS.apply)
      case 'apply': return moving(this, stage, here, OS.archive, OS.apply)
      default: return { kind: 'new', cmd: OS.propose, n: here.length, clarify: 0 }
    }
  },
}

// ---------- Kiro (its CLI's commands; the IDE has buttons for the same steps) ----------

const KIRO_CMD = { new: '/spec new <name>', step: '/spec <name>', run: '/spec run <name>' } as const
const forSpec = (cmd: string, f: Feature | null) => (f ? cmd.replace('<name>', f.id) : cmd)

const KIRO: Flow = {
  id: 'kiro',
  stages: [
    { key: 'steering', kinds: ['context'], cmd: null },
    { key: 'requirements', kinds: ['requirements'], cmd: KIRO_CMD.new },
    { key: 'design', kinds: ['design'], cmd: KIRO_CMD.step },
    { key: 'tasks', kinds: ['tasks'], cmd: KIRO_CMD.step },
    { key: 'implement', kinds: ['tasks'], cmd: KIRO_CMD.run, progress: true },
    { key: 'done', kinds: ['tasks'], cmd: null, progress: true },
  ],
  unit: 'spec', start: KIRO_CMD.new, setup: null, clarify: null,
  files: { context: 'steering/*.md' },
  labels: { items: 'pr.steer', none: 'pr.steer.none', empty: 'e.project.kiro', noShared: 'e.shared.kiro' },
  next(f) {
    switch (f.stage) {
      case 'requirements': case 'design': return { cmd: forSpec(KIRO_CMD.step, f), left: 0 }
      case 'tasks': case 'implement': return { cmd: forSpec(KIRO_CMD.run, f), left: tasksLeft(f) }
      default: return { cmd: null, left: 0 }
    }
  },
  making: (kind, f) => {
    const cmd = (({ requirements: KIRO_CMD.new, design: KIRO_CMD.step, tasks: KIRO_CMD.step }) as Partial<Record<DocKind, string>>)[kind]
    return cmd ? forSpec(cmd, kind === 'requirements' ? null : f) : null
  },
  guide(_p, stage, here) {
    switch (stage) {
      case 'steering': return { kind: 'first', cmd: KIRO_CMD.new }
      case 'requirements': case 'design': return moving(this, stage, here, KIRO_CMD.step, KIRO_CMD.step)
      case 'tasks': return moving(this, stage, here, KIRO_CMD.run, KIRO_CMD.run)
      case 'implement': return here.length ? { kind: 'implement', cmd: KIRO_CMD.run, left: here.reduce((n, f) => n + tasksLeft(f), 0) } : { kind: 'wait', cmd: KIRO_CMD.run }
      default: return { kind: 'new', cmd: KIRO_CMD.new, n: here.length, clarify: 0 }
    }
  },
}

export const FLOWS: Record<FormatId, Flow> = { 'spec-kit': SPEC_KIT, openspec: OPENSPEC, kiro: KIRO }
export { SPEC_KIT }

export const flowOf = (p: Pick<Project, 'format'> | null | undefined): Flow => FLOWS[p?.format ?? 'spec-kit']

// The format the server named on the page's root element, for what is drawn before the project arrives.
export function bootFlow(): Flow {
  const id = typeof document === 'undefined' ? undefined : document.documentElement.dataset.format
  return id && id in FLOWS ? FLOWS[id as FormatId] : SPEC_KIT
}

export const stageDef = (flow: Flow, key: StageKey) => flow.stages.find(s => s.key === key)
export const isProjectStage = (flow: Flow, key: StageKey | null) => key === flow.stages[0].key
export const lastStage = (flow: Flow) => flow.stages[flow.stages.length - 1].key
export const finished = (flow: Flow, f: Feature) => f.stage === lastStage(flow)

// Every stage key and every tab a stage can have, in any format: what an address may name.
export const ALL_STAGES = [...new Set(Object.values(FLOWS).flatMap(f => f.stages.map(s => s.key)))]
export const SUBS: Partial<Record<StageKey, DocKind[]>> = {}
for (const f of Object.values(FLOWS)) for (const s of f.stages.slice(1)) if (s.kinds.length > 1) SUBS[s.key] = [...new Set([...(SUBS[s.key] ?? []), ...s.kinds.slice(1)])]
