export type FormatId = 'spec-kit' | 'openspec' | 'kiro'
// The stages a unit of work can stand at, per format: spec-kit, then OpenSpec, then Kiro (shared names are shared).
export type Stage = 'specify' | 'plan' | 'tasks' | 'implement' | 'done'
  | 'propose' | 'design' | 'apply' | 'archive'
  | 'requirements'
export type DocKind = 'spec' | 'plan' | 'tasks' | 'constitution' | 'checklist'
  | 'research' | 'data-model' | 'quickstart' | 'contract' | 'other'
  | 'capability' | 'delta' | 'proposal' | 'design' | 'requirements' | 'context'
export type DocRef = { path: string; kind: DocKind; hash: string; error?: string }
export type Feature = {
  id: string; stage: Stage; docs: DocRef[]
  tasks: { done: number; total: number } | null
  openQuestions: number
}
export type Project = {
  root: string; name: string
  about: string | null                                          // first prose paragraph of the README, plain text
  constitution: DocRef | null; constitutionVersion: string | null
  constitutionRatified: string | null; constitutionAmended: string | null
  principles: string[]
  currentFeature: string | null; features: Feature[]
  format?: Exclude<FormatId, 'spec-kit'>                        // absent: spec-kit, whose JSON stays as it was
  shared?: DocRef[]                                             // project documents other than a constitution
}
export type Field = { label: string; value: string }            // value is markdown
export type CheckItem = {
  id: string | null; done: boolean; parallel: boolean; story: string | null; text: string
  optional?: true; notes?: string                               // set by the OpenSpec and Kiro task readers only
}
export type Scenario = { given: string; when: string; then: string }
export type Step = { key: string; text: string }                // key: GIVEN, WHEN, THEN, AND, IF … or '' for a plain sentence
export type Criterion = { id: string | null; name: string | null; steps: Step[] }
export type Requirement = { id: string | null; title: string; story: string | null; text: string; criteria: Criterion[]; rest: string }
export type Block =
  | { kind: 'raw'; heading: string | null; depth: number; markdown: string }
  | { kind: 'stories'; items: { title: string; priority: string | null; narrative: string | null; why: string | null; test: string | null; scenarios: Scenario[]; rest: string }[] }
  | { kind: 'idList'; heading: string; depth: number; items: { id: string; text: string }[]; rest: string }
  | { kind: 'phase'; title: string; fields: Field[]; items: CheckItem[]; rest: string }
  | { kind: 'fields'; heading: string; items: Field[]; rest: string }
  | { kind: 'cards'; heading: string; items: { title: string; markdown: string }[] }
  | { kind: 'decisions'; items: { title: string; fields: Field[]; rest: string }[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'requirements'; heading: string; depth: number; op: string | null; text: string; items: Requirement[]; rest: string }
export type ParsedDoc = { ref: DocRef; title: string | null; meta: Field[]; blocks: Block[] }
