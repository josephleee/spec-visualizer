import { byStory, doneCount, phasesOf, taskColumns } from '../guide.ts'
import { FieldsSheet, Mark, Rich, Sec, Stats, TaskRows, Title, Value, fieldOf } from '../parts.tsx'
import type { Form } from './types.ts'

// Structure: how many phases, which tasks can run together, which story each phase serves.
export const tasks: Form = (doc, { t }) => {
  const phases = phasesOf(doc.blocks), all = phases.flatMap(p => p.items)
  if (!all.length) return null
  return {
    used: phases,
    body: (
      <>
        <Stats items={[[phases.length, t('t.phases')], [all.length, t('t.tasks')], [all.filter(x => x.parallel).length, t('t.par')], [byStory(all).filter(g => g.story).length, t('t.stories')]]} />
        <Sec title={t('t.struct')} note={t('t.struct.n')}>
          <ul className="legend">
            <li><span className="mk done" />{t('t.done')}</li><li><span className="mk" />{t('t.open')}</li>
            <li><span className="mk">P</span>{t('t.par')}</li><li><span className="us">US1</span>{t('t.story')}</li>
          </ul>
          {phases.map((p, i) => {
            const goal = fieldOf(p.fields, 'Goal') ?? fieldOf(p.fields, 'Purpose'), done = doneCount(p.items)
            const story = p.items.find(x => x.story)?.story
            const others = p.fields.filter(f => f !== goal)
            return (
              <article key={i} className="lane">
                <div className="lane-h"><h3><Title>{p.title}</Title></h3>{goal && <div className="lane-goal"><Value md={goal.value} /></div>}</div>
                <div className="track" role="img" aria-label={t('i.aria', p.items.length, done)}>
                  {taskColumns(p.items).map((col, j) => <span key={j} className="col">{col.map((x, k) => <Mark key={k} item={x} />)}</span>)}
                </div>
                <div className="lane-n">{story && <span className="us">{story}</span>}<b>{done} / {p.items.length}</b></div>
                <details>
                  <summary>{t('t.expand', p.items.length)}</summary>
                  <FieldsSheet items={others} /><TaskRows items={p.items} /><Rich md={p.rest} />
                </details>
              </article>
            )
          })}
        </Sec>
      </>
    ),
  }
}
