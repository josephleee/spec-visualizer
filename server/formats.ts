// One adapter per spec-driven format: how to recognise a project, what to watch, how to scan it and read its documents.
import type { Reading } from './parsers.ts'
import { isSpecKit, scanProject } from './scan.ts'
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

// Every format the folder matches, in order of precedence: spec-kit first, so a folder that opened as spec-kit
// before other formats were read still does.
export const detect = (root: string): Adapter[] => ADAPTERS.filter((a) => a.matches(root))
