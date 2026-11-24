import { useLang } from '../i18n.ts'
import { Rich, Stats, Title, Value } from '../parts.tsx'
import { outline } from './Outline.tsx'
import { isKind, type B, type Form } from './types.ts'

// The requirements of one block as cards: number, operation (OpenSpec deltas), title, user story, statement, and each
// criterion with its steps in the order written (GIVEN / WHEN / THEN / AND, or an EARS condition and response).
export function Requirements({ b }: { b: B<'requirements'> }) {
  const { t } = useLang()
  return (
    <div className="rqs">
      <Rich md={b.text} />
      {b.items.map((r, i) => (
        <article key={i} className={(b.op ? `rq op-${b.op.toLowerCase()}` : 'rq') + (r.criteria.length || r.rest.trim() ? '' : ' solo')}>
          <div className="rq-h">
            {(r.id || b.op) && <div className="rq-tags">{r.id && <span className="rq-no">{r.id}</span>}{b.op && <span className="rq-op">{b.op}</span>}</div>}
            <h3><Title>{r.title}</Title></h3>
            {r.story && <div className="kv"><b>{t('q.story')}</b><Value md={r.story} /></div>}
            <Rich md={r.text} />
          </div>
          {(r.criteria.length > 0 || !!r.rest.trim()) && <div className="rq-b">
            {r.criteria.length > 0 && (
              <ol className="crits">
                {r.criteria.map((c, j) => (
                  <li key={j} className="crt">
                    {(c.id || c.name) && <div className="crt-h">{c.id && <code>{c.id}</code>}{c.name && <b><Title>{c.name}</Title></b>}</div>}
                    <dl className="stps">
                      {c.steps.map((s, k) => <div key={k} className={s.key === 'THEN' ? 'stp then' : s.key ? 'stp' : 'stp bare'}><dt>{s.key}</dt><dd><Value md={s.text} /></dd></div>)}
                    </dl>
                  </li>
                ))}
              </ol>
            )}
            <Rich md={r.rest} />
          </div>}
        </article>
      ))}
      <Rich md={b.rest} />
    </div>
  )
}

// A RENAMED section lists FROM / TO pairs rather than requirement headers: each TO line is one rename.
const count = (b: B<'requirements'>) => (b.op === 'RENAMED' ? b.text.match(/^\s*(?:[-*+]\s*)?TO:/gim)?.length ?? 0 : b.items.length)

// OpenSpec specs and delta specs, Kiro requirements and bugfix documents: counts, then every block in file order.
export const requirements: Form = (doc, { t }) => {
  const blocks = doc.blocks.filter(isKind('requirements'))
  if (!blocks.length) return null
  const items = blocks.flatMap(b => b.items), criteria = items.flatMap(r => r.criteria)
  const ops = ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'] as const
  return {
    used: doc.blocks,
    body: (
      <>
        <Stats items={[[items.length, t('q.reqs')], criteria.length > 0 && [criteria.length, t(criteria.some(c => c.name) ? 'q.scen' : 'q.crit')],
          ...ops.map(op => blocks.some(b => b.op === op) && [blocks.filter(b => b.op === op).reduce((n, b) => n + count(b), 0), t(`q.${op}`)] as [number, string])]} />
        {outline(doc, t, false)}
      </>
    ),
  }
}

// design.md: how many sections, decisions and diagrams it has, then every section in file order.
export const design: Form = (doc, { t }) => {
  if (!doc.blocks.length) return null
  const sections = doc.blocks.filter(b => b.kind !== 'raw' || b.depth <= 2).length
  const decisions = doc.blocks.filter(isKind('cards')).reduce((n, b) => n + b.items.length, 0)
  const text = doc.blocks.map(b => (b.kind === 'raw' ? b.markdown : b.kind === 'cards' ? b.items.map(c => c.markdown).join('\n') : '')).join('\n')
  const diagrams = text.match(/^ {0,3}(?:```|~~~)\s*mermaid\b/gm)?.length ?? 0
  return {
    used: doc.blocks,
    body: <><Stats items={[[sections, t('dz.sections')], decisions > 0 && [decisions, t('dz.cards')], diagrams > 0 && [diagrams, t('dz.diagrams')]]} />{outline(doc, t, false)}</>,
  }
}
