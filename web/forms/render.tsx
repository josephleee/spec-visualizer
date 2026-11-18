import type { ReactNode } from 'react'
import type { DocKind, ParsedDoc } from '../../server/types.ts'
import { formFor } from './index.ts'
import { Generic, More, outline } from './Outline.tsx'
import { Title, Value } from '../parts.tsx'
import type { FormCtx } from './types.ts'

// The document's own title and header fields, as the page header shows them.
export const DocTitle = ({ doc }: { doc: ParsedDoc }) => (doc.title ? <Title>{doc.title}</Title> : null)
export const DocMeta = ({ doc }: { doc: ParsedDoc }) => (doc.meta.length === 0 ? null : (
  <dl className="meta">{doc.meta.map((m, i) => <div key={i}><dt>{m.label}</dt><dd><Value md={m.value} /></dd></div>)}</dl>
))

// The whole body of a document page: the form for its kind plus whatever the form did not draw,
// or the document in its own order when it has none of the expected structure. Nothing is dropped.
export function renderDoc(doc: ParsedDoc, kind: DocKind, progress: boolean, ctx: FormCtx): ReactNode {
  const form = formFor(kind, progress), drawn = form?.(doc, ctx)
  if (drawn) return <>{drawn.body}<More blocks={doc.blocks.filter(b => !drawn.used.includes(b))} t={ctx.t} /></>
  if (doc.blocks.length === 1 && doc.blocks[0].kind === 'code') return <section className="sec"><Generic b={doc.blocks[0]} /></section>
  return outline(doc, ctx.t, !!form)
}
