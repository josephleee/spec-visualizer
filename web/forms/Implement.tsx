import { CMD, byStory, doneCount, nextUp, percent, phasesOf, required } from '../guide.ts'
import { Bar, CmdRow, FieldsSheet, Mark, Rich, Sec, TaskRows, Title } from '../parts.tsx'
import type { Form } from './types.ts'

// Progress: how much is done, what is left per phase and per story, and what to type next.
export const implement: Form = (doc, { t, feature, flow }) => {
  // Every task has a cell; optional ones (Kiro) are drawn but not counted.
  const phases = phasesOf(doc.blocks), all = required(phases.flatMap(p => p.items))
  if (!all.length) return null
  // The server's own count is the figure; the cells are drawn from the document.
  const total = feature?.tasks?.total ?? all.length, done = feature?.tasks?.done ?? doneCount(all), left = total - done
  const next = nextUp(phases), stories = byStory(all), openPhases = phases.filter(p => required(p.items).some(x => !x.done)).length
  // What to type: spec-kit's implement; another format's next command for the feature (OpenSpec archives a finished change).
  const cmd = flow && flow.id !== 'spec-kit' && feature ? flow.next(feature).cmd : CMD.implement
  return {
    used: phases,
    body: (
      <>
        <section className="sec prog">
          <div className="prog-n"><b>{done}</b><span>/ {total}</span><em>{t('i.pct', percent(done, total), left)}</em></div>
          <div className="cellstrip" role="img" aria-label={t('i.aria', total, done)}>
            {phases.map((p, i) => <span key={i} className="cg">{p.items.map((x, j) => <Mark key={j} item={x} next={next.has(x)} />)}</span>)}
          </div>
          {left > 0 && cmd
            ? <div className="nextbox"><span className="lbl">{t('i.next')}</span><CmdRow cmd={cmd} big /><p>{t('i.cont', left)}</p></div>
            : left <= 0 && cmd && flow?.id === 'openspec'
              ? <div className="nextbox"><span className="lbl">{t('i.next')}</span><CmdRow cmd={cmd} big /><p>{t('i.archive')}</p></div>
              : <div className="nextbox fin"><p>{left > 0 ? t('i.open', left) : t('i.fin')}</p></div>}
          {total > all.length && <p className="prog-note">{t('i.outside', total - all.length, total)}</p>}
        </section>
        <Sec title={t('i.left')} note={openPhases ? t('i.left.n', openPhases) : t('i.left.none')}>
          {phases.map((p, i) => {
            const open = required(p.items).filter(x => !x.done), isNext = open.some(x => next.has(x))
            return (
              <article key={i} className={isNext ? 'prow open next' : open.length ? 'prow open' : 'prow'}>
                <h3><Title>{p.title}</Title></h3><Bar done={required(p.items).length - open.length} total={required(p.items).length} />
                <b>{open.length ? t('i.nleft', open.length) : t('t.done')}</b>
                {open.length > 0 && <TaskRows items={open} next={next} />}
                {(p.items.length > 0 || p.fields.length > 0 || p.rest.trim()) && (
                  <details><summary>{t('t.expand', p.items.length)}</summary><FieldsSheet items={p.fields} /><TaskRows items={p.items} next={next} /><Rich md={p.rest} /></details>
                )}
              </article>
            )
          })}
        </Sec>
        {/* Stories are spec-kit's ([US1]); another format shows this only when its tasks name some. */}
        {(!flow || flow.id === 'spec-kit' || all.some(x => x.story)) && <Sec title={t('i.bystory')} note={t('i.groups', stories.length)}>
          <div className="bystory">
            {stories.map((g, i) => (
              <div key={i} className={g.items.some(x => next.has(x)) ? 'bs next' : 'bs'}>
                <span className="us">{g.story ?? t('i.common')}</span><b>{g.done} / {g.items.length}</b>
                <span className="bs-m" role="img" aria-label={t('i.aria', g.items.length, g.done)}>{g.items.map((x, j) => <Mark key={j} item={x} next={next.has(x)} />)}</span>
                <em>{g.done < g.items.length ? t('i.nleft', g.items.length - g.done) : t('t.done')}</em>
              </div>
            ))}
          </div>
        </Sec>}
      </>
    ),
  }
}
