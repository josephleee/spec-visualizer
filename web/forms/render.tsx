import type { ReactNode } from 'react'
import type { DocKind, ParsedDoc } from '../../server/types.ts'
import { formFor } from './index.ts'
import { Generic, More, outline } from './Outline.tsx'
import type { FormCtx } from './types.ts'

// The whole body of a document page: the form for its kind plus whatever the form did not draw,
// or the document in its own order when it has none of the expected structure. Nothing is dropped.
export function renderDoc(doc: ParsedDoc, kind: DocKind, progress: boolean, ctx: FormCtx): ReactNode {
  const form = formFor(kind, progress), drawn = form?.(doc, ctx)
  if (drawn) return <>{drawn.body}<More blocks={doc.blocks.filter(b => !drawn.used.includes(b))} t={ctx.t} /></>
  if (doc.blocks.length === 1 && doc.blocks[0].kind === 'code') return <section className="sec"><Generic b={doc.blocks[0]} /></section>
  return outline(doc, ctx.t, !!form)
}
