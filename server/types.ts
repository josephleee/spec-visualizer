export type Stage = 'specify' | 'plan' | 'tasks' | 'implement' | 'done'
export type DocKind = 'spec' | 'plan' | 'tasks' | 'constitution' | 'checklist'
  | 'research' | 'data-model' | 'quickstart' | 'contract' | 'other'
export type DocRef = { path: string; kind: DocKind; hash: string; error?: string }
export type Feature = {
  id: string; stage: Stage; docs: DocRef[]
  tasks: { done: number; total: number } | null
  openQuestions: number
}
export type Project = {
  root: string; name: string
  constitution: DocRef | null; constitutionVersion: string | null
  currentFeature: string | null; features: Feature[]
}
export type Field = { label: string; value: string }            // value is markdown
export type CheckItem = { id: string | null; done: boolean; parallel: boolean; story: string | null; text: string }
export type Scenario = { given: string; when: string; then: string }
export type Block =
  | { kind: 'raw'; heading: string | null; depth: number; markdown: string }
  | { kind: 'stories'; items: { title: string; priority: string | null; narrative: string | null; why: string | null; test: string | null; scenarios: Scenario[]; rest: string }[] }
  | { kind: 'idList'; heading: string; depth: number; items: { id: string; text: string }[]; rest: string }
  | { kind: 'phase'; title: string; fields: Field[]; items: CheckItem[]; rest: string }
  | { kind: 'fields'; heading: string; items: Field[]; rest: string }
  | { kind: 'cards'; heading: string; items: { title: string; markdown: string }[] }
  | { kind: 'decisions'; items: { title: string; fields: Field[]; rest: string }[] }
  | { kind: 'code'; lang: string; text: string }
export type ParsedDoc = { ref: DocRef; title: string | null; meta: Field[]; blocks: Block[] }
