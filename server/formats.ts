// One adapter per spec-driven format: how to recognise a project, what to watch, how to scan it and read its documents.
import type { Reading } from './parsers.ts'
import { entries, isSpecKit, realDir, realFile, scanProject } from './scan.ts'
import { isOpenSpec, OPENSPEC_PARSERS, scanOpenSpec } from './openspec.ts'
import { isKiro, KIRO_PARSERS, scanKiro } from './kiro.ts'
import type { FormatId, Project } from './types.ts'

export type Adapter = Reading & {
  id: FormatId
  name: string          // as the CLI names the project
  unit: string          // what the CLI counts, plural
  folders: string       // the folders that make a project of this format, for messages
  matches(root: string): boolean
  watch: string[]       // top-level folders watched for changes
  scan(root: string): Project
}

export const ADAPTERS: Adapter[] = [
  { id: 'spec-kit', name: 'spec-kit', unit: 'features', folders: 'specs/ or .specify/', matches: isSpecKit, watch: ['specs', '.specify'], scan: (r) => scanProject(r) },
  { id: 'openspec', name: 'OpenSpec', unit: 'changes', folders: 'openspec/', matches: isOpenSpec, watch: ['openspec'], scan: (r) => scanOpenSpec(r), parsers: OPENSPEC_PARSERS },
  { id: 'kiro', name: 'Kiro', unit: 'specs', folders: '.kiro/specs/ or .kiro/steering/', matches: isKiro, watch: ['.kiro'], scan: (r) => scanKiro(r), parsers: KIRO_PARSERS, frontMatter: true },
]

export const adapter = (id: FormatId): Adapter => ADAPTERS.find((a) => a.id === id)!

// What makes a folder spec-kit's own rather than any folder named specs/: a .specify/ folder, or a feature folder holding
// spec.md or plan.md (spec-kit writes one of them first; tasks.md alone is also OpenSpec's and Kiro's).
export function specKitEvidence(root: string): string | null {
  if (realDir(root, '.specify')) return '.specify/'
  if (!realDir(root, 'specs')) return null
  for (const e of entries(`${root}/specs`).filter((x) => x.isDirectory()).map((x) => x.name).sort())
    for (const doc of ['spec.md', 'plan.md']) if (realFile(root, `specs/${e}/${doc}`)) return `specs/${e}/${doc}`
  return null
}

const kiroWhy = (root: string) => ['.kiro/specs', '.kiro/steering'].filter((d) => realDir(root, d)).map((d) => `${d}/`).join(' and ')

export type Found = { adapter: Adapter; why: string }

// Every format the folder matches, the one to open first, each with why it matched. spec-kit comes first when it has
// documents of its own, so every real spec-kit folder opens as before; a specs/ folder without them (Gherkin files,
// loose notes, another tool's layout) gives way to OpenSpec or Kiro content, and stays a choice for --format.
export function detect(root: string): Found[] {
  const evidence = specKitEvidence(root)
  const found = ADAPTERS.filter((a) => a.matches(root)).map((adapter): Found => ({
    adapter,
    why: adapter.id === 'spec-kit' ? evidence ?? 'specs/ (no spec-kit documents in it)' : adapter.id === 'openspec' ? 'openspec/' : kiroWhy(root),
  }))
  if (evidence || found.length < 2 || found[0].adapter.id !== 'spec-kit') return found
  return [...found.slice(1), found[0]]
}
