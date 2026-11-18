import type { ReactNode } from 'react'
import type { Block, Feature, ParsedDoc } from '../../server/types.ts'
import type { T } from '../i18n.ts'
import type { Flow } from '../flows.ts'

export type B<K extends Block['kind']> = Extract<Block, { kind: K }>
export const isKind = <K extends Block['kind']>(kind: K) => (b: Block): b is B<K> => b.kind === kind
// A heading with nothing under it carries no content of its own.
export const hasBody = (b: Block) => !(b.kind === 'raw' && !b.markdown.trim())

export type FormCtx = { feature: Feature | null; t: T; flow?: Flow } // no flow: spec-kit
// A form draws the blocks it recognises and reports them; null means the document has none of the expected structure.
export type Form = (doc: ParsedDoc, ctx: FormCtx) => { body: ReactNode; used: Block[] } | null
