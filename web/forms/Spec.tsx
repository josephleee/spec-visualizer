import { specCounts } from '../guide.ts'
import { useLang } from '../i18n.ts'
import { Markdown } from '../Markdown.tsx'
import { IdRows, Rich, Sec, Stats, Title, Value, cssVars } from '../parts.tsx'
import { isKind, type B, type Form } from './types.ts'

const STEPS = ['given', 'when', 'then'] as const

export function Stories({ items }: { items: B<'stories'>['items'] }) {
  const { t } = useLang()
  return (
    <>
      {items.map((s, n) => (
        <article key={n} className="story">
          <div className="story-h">
            {s.priority && <span className={/^p[1-3]$/i.test(s.priority) ? `pri ${s.priority.toLowerCase()}` : 'pri'}>{s.priority}</span>}
            <span className="story-no">{t('sp.story', n + 1, s.scenarios.length)}</span>
            <h3><Title>{s.title}</Title></h3>
            {s.narrative && <div className="story-nar"><Markdown>{s.narrative}</Markdown></div>}
            {s.why && <div className="kv"><b>{t('sp.why')}</b><Value md={s.why} /></div>}
            {s.test && <div className="kv"><b>{t('sp.test')}</b><Value md={s.test} /></div>}
          </div>
          <div className="story-b">
            <ol className="flows">
              {s.scenarios.map((c, i) => (
                <li key={i} className="gwt">
                  {STEPS.map(k => <div key={k} className={`gw ${k}`}><span>{k[0].toUpperCase() + k.slice(1)}</span><div><Value md={c[k]} /></div></div>)}
                </li>
              ))}
            </ol>
            <Rich md={s.rest} />
          </div>
        </article>
      ))}
    </>
  )
}

// Counts, stories with their scenario flows, requirement groups with a size bar, success criteria.
export const spec: Form = (doc, { t, feature }) => {
  const c = specCounts(doc.blocks)
  if (!c.stories.length && !c.requirements.length && !c.criteria.length) return null
  return {
    used: [...doc.blocks.filter(isKind('stories')), ...c.requirements, ...c.criteria],
    body: (
      <>
        <Stats items={[[c.stories.length, t('sp.stories')], [c.nScenarios, t('sp.scen')], [c.nRequirements, t('sp.reqs')], [c.nCriteria, t('sp.crit')],
          feature && [feature.openQuestions, t('sp.open')]]} />
        {c.stories.length > 0 && (
          <Sec title={t('sp.stories')} note={c.priorities.map(p => `${p.priority} ${t('n.count', p.n)}`).join(' · ')}>
            <Stories items={c.stories} />
          </Sec>
        )}
        {c.requirements.length > 0 && (
          <Sec title={t('sp.reqs')} note={t('sp.groups', c.requirements.length, c.nRequirements)}>
            <div className="dist" role="img" aria-label={t('sp.dist')}>
              {c.requirements.map((b, i) => (
                <span key={i} style={cssVars({ '--n': b.items.length })} title={`${b.heading} ${b.items.length}`}>
                  <b>{b.items.length}</b>{b.items.length >= 7 && <em>{b.heading}</em>}
                </span>
              ))}
            </div>
            <div className="reqs">
              {c.requirements.map((b, i) => (
                <section key={i} className="req">
                  <header><h3><Title>{b.heading}</Title></h3><span>{t('n.count', b.items.length)}</span></header>
                  <IdRows items={b.items} /><Rich md={b.rest} />
                </section>
              ))}
            </div>
          </Sec>
        )}
        {c.criteria.map((b, i) => (
          <Sec key={i} title={t('sp.crit')} note={`${b.heading} · ${t('n.count', b.items.length)}`}>
            <ol className="crit">{b.items.map((it, j) => <li key={j}><code>{it.id}</code><div><Value md={it.text} /></div></li>)}</ol>
            <Rich md={b.rest} />
          </Sec>
        ))}
      </>
    ),
  }
}
