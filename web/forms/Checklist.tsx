import { doneCount, phasesOf } from '../guide.ts'
import { FieldsSheet, Rich, Sec, Stats, TaskTags, Tick, Title, Value } from '../parts.tsx'
import type { Form } from './types.ts'

// What was checked, group by group.
export const checklist: Form = (doc, { t, feature }) => {
  const groups = phasesOf(doc.blocks), all = groups.flatMap(g => g.items)
  if (!all.length) return null
  return {
    used: groups,
    body: (
      <>
        <Stats items={[[`${doneCount(all)} / ${all.length}`, t('k.checked')], [groups.length, t('k.groups')],
          feature && [t(`n.${feature.stage}`), t('k.stage')],
          feature && [feature.tasks ? `${feature.tasks.done} / ${feature.tasks.total}` : t('k.notasks'), t('k.feat')]]} />
        <Sec title={t('k.title')} note={t('i.groups', groups.length)}>
          <div className="checks">
            {groups.map((g, i) => (
              <section key={i} className="chk">
                <header><h3><Title>{g.title}</Title></h3><span>{doneCount(g.items)} / {g.items.length}</span></header>
                <FieldsSheet items={g.fields} />
                <ul>
                  {g.items.map((x, j) => (
                    <li key={j} className={x.done ? 'done' : undefined}>
                      <Tick on={x.done} /><span className="sr">{t(x.done ? 't.done' : 't.open')}</span>
                      <div>{x.id && <code>{x.id}</code>} <TaskTags item={x} /> <Value md={x.text} /></div>
                    </li>
                  ))}
                </ul>
                <Rich md={g.rest} />
              </section>
            ))}
          </div>
        </Sec>
      </>
    ),
  }
}
