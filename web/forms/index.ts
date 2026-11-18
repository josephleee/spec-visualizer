import type { DocKind } from '../../server/types.ts'
import { checklist } from './Checklist.tsx'
import { constitution } from './Constitution.tsx'
import { implement } from './Implement.tsx'
import { plan } from './Plan.tsx'
import { dataModel, quickstart, research } from './PlanDocs.tsx'
import { spec } from './Spec.tsx'
import { tasks } from './Tasks.tsx'
import type { Form } from './types.ts'

// tasks.md is read twice: as structure at the tasks stage, as progress at the implement stage.
export const formFor = (kind: DocKind, progress: boolean): Form | null => ({
  constitution, spec, plan, research, 'data-model': dataModel, quickstart,
  tasks: progress ? implement : tasks, checklist, contract: null, other: null,
} satisfies Record<DocKind, Form | null>)[kind]
