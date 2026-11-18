import { useLang } from '../i18n.ts'
import { Rich, Sec, Title, Value, clean, fieldOf, splitNo } from '../parts.tsx'
import { hasBody, isKind, type B, type Form } from './types.ts'

const DECISION_FIELDS = ['question', 'decision', 'rationale', 'alternatives considered']

export function Decisions({ items }: { items: B<'decisions'>['items'] }) {
  const { t } = useLang()
  return (
    <>
      {items.map((x, n) => {
        const [no, name] = splitNo(x.title, n), f = (label: string) => fieldOf(x.fields, label)
        const question = f('Question'), decision = f('Decision'), why = f('Rationale'), alts = f('Alternatives Considered')
        return (
          <article key={n} className="dec">
            <header><span className="dec-no">{no}</span><div><h3><Title>{name}</Title></h3>{question && <div className="dec-q"><Value md={question} /></div>}</div></header>
            <div className="dec-cols">
              <div className="dec-yes">
                <span className="lbl">{t('r.dec')}</span>{decision && <div className="dec-d"><Value md={decision} /></div>}
                {why && <><span className="lbl">{t('r.why')}</span><Rich md={why} /></>}
              </div>
              <div className="dec-alt">
                {alts ? <><span className="lbl">{t('r.alt')}</span><div className="alts"><Rich md={alts} /></div></> : <span className="lbl">{t('r.noalt')}</span>}
                {x.fields.filter(y => !DECISION_FIELDS.includes(y.label.toLowerCase())).map((y, i) => <div key={i}><span className="lbl">{y.label}</span><Rich md={y.value} /></div>)}
              </div>
            </div>
            <Rich md={x.rest} />
          </article>
        )
      })}
    </>
  )
}

// research.md: each decision beside the alternatives it rejected.
export const research: Form = (doc, { t }) => {
  const blocks = doc.blocks.filter(isKind('decisions')), all = blocks.flatMap(b => b.items)
  if (!all.length) return null
  return { used: blocks, body: <Sec title={t('r.title')} note={t('n.count', all.length)}><Decisions items={all} /></Sec> }
}

// data-model.md: one card per entity, then the relationships as written.
export const dataModel: Form = (doc, { t }) => {
  const blocks = doc.blocks.filter(isKind('cards')), all = blocks.flatMap(b => b.items)
  if (!all.length) return null
  const rel = doc.blocks.find((b): b is B<'raw'> => b.kind === 'raw' && b.heading === 'Relationships' && hasBody(b))
  return {
    used: rel ? [...blocks, rel] : blocks,
    body: (
      <>
        <Sec title={t('d.ent')} note={t('n.count', all.length)}>
          <div className="ents">
            {all.map((c, n) => {
              const [no, name] = splitNo(c.title, n)
              return <article key={n} className="ent"><header><span>{no}</span><h3><Title>{name}</Title></h3></header><Rich md={c.markdown} /></article>
            })}
          </div>
        </Sec>
        {rel && <Sec title={t('d.rel')}><Rich md={rel.markdown} /></Sec>}
      </>
    ),
  }
}

// quickstart.md has no parser of its own: every section is a numbered step, in order.
export const quickstart: Form = (doc, { t }) => {
  const steps = doc.blocks.filter(isKind('raw')).filter(hasBody)
  if (!steps.length) return null
  return {
    used: steps,
    body: (
      <Sec title={t('p.steps')} note={t('q.steps', steps.length)}>
        <ol className="steps">
          {steps.map((b, i) => <li key={i}><h3><Title>{clean(b.heading ?? '') || t('o.intro')}</Title></h3><Rich md={b.markdown} /></li>)}
        </ol>
      </Sec>
    ),
  }
}
