import type { Block } from '../../server/types.ts'
import { FieldsSheet, Rich, Sec, clean } from '../parts.tsx'
import { hasBody, isKind, type B, type Form } from './types.ts'

// Summary as the lead, Technical Context as a sheet of fields, the check table and the trees as written.
export const plan: Form = (doc, { t }) => {
  const raw = (name: string) => doc.blocks.find((b): b is B<'raw'> => b.kind === 'raw' && b.heading === name && hasBody(b))
  const summary = raw('Summary'), context = doc.blocks.find(isKind('fields')), check = raw('Constitution Check'), structure = raw('Project Structure')
  const used = [summary, context, check, structure].filter((b): b is NonNullable<typeof b> => !!b) as Block[]
  if (!used.length) return null
  return {
    used,
    body: (
      <>
        {summary && <section className="sec lead"><Rich md={summary.markdown} /></section>}
        {context && <Sec title={t('p.ctx')} note={`${clean(context.heading)} · ${t('n.items', context.items.length)}`}><FieldsSheet items={context.items} /><Rich md={context.rest} /></Sec>}
        {check && <Sec title={t('p.check')} note={t('p.check.n')}><Rich md={check.markdown} /></Sec>}
        {structure && <Sec title={t('p.struct')} note={t('p.struct.n')}><div className="trees"><Rich md={structure.markdown} /></div></Sec>}
      </>
    ),
  }
}
