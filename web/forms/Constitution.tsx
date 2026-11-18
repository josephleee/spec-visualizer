import type { ReactNode } from 'react'
import { FieldsSheet, Rich, Sec, Stats, Title, Value, fieldOf, splitNo } from '../parts.tsx'
import { isKind, type Form } from './types.ts'

const SHOWN_AS_STATS = ['version', 'ratified', 'last amended']

// Principle plates, the version line as large figures, then one sheet per field section.
export const constitution: Form = (doc, { t }) => {
  const cards = doc.blocks.find(isKind('cards'))
  if (!cards) return null
  const fields = doc.blocks.filter(isKind('fields'))
  const gov = fields.find(b => fieldOf(b.items, 'Version'))
  const fig = (label: string, name: string): [ReactNode, string] | null => {
    const v = gov && fieldOf(gov.items, label)
    return v ? [<Value md={v} />, name] : null
  }
  return {
    used: [cards, ...fields],
    body: (
      <>
        <Stats items={[[cards.items.length, t('principles')], fig('Version', t('c.version')), fig('Ratified', t('c.ratified')), fig('Last Amended', t('c.amended'))]} />
        <Sec title={t('principles')} note={t('n.count', cards.items.length)}>
          <ol className="plates">
            {cards.items.map((c, n) => {
              const [no, name] = splitNo(c.title, n)
              return (
                <li key={n} className={c.markdown.length > 600 ? 'plate long' : 'plate'}>
                  <span className="plate-no">{no}</span><h3><Title>{name}</Title></h3><Rich md={c.markdown} />
                </li>
              )
            })}
          </ol>
        </Sec>
        {fields.map((b, i) => {
          const items = b === gov ? b.items.filter(f => !SHOWN_AS_STATS.includes(f.label.toLowerCase())) : b.items
          return <Sec key={i} title={<Title>{b.heading}</Title>} note={t('n.items', items.length)}><FieldsSheet items={items} /><Rich md={b.rest} /></Sec>
        })}
      </>
    ),
  }
}
