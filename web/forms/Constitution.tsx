import type { ReactNode } from 'react'
import type { Field } from '../../server/types.ts'
import { FieldsSheet, Rich, Sec, Stats, Title, Value, fieldOf, splitNo } from '../parts.tsx'
import { isKind, type Form } from './types.ts'

// Principle plates, the version line as large figures, then one sheet per field section.
export const constitution: Form = (doc, { t }) => {
  const cards = doc.blocks.find(isKind('cards'))
  if (!cards) return null // a second cards block is left to the list of undrawn blocks
  const fields = doc.blocks.filter(isKind('fields'))
  const gov = fields.find(b => fieldOf(b.items, 'Version'))
  const version = gov && fieldOf(gov.items, 'Version'), ratified = gov && fieldOf(gov.items, 'Ratified'), amended = gov && fieldOf(gov.items, 'Last Amended')
  // A label written without a value is shown as missing, not as a blank figure.
  const fig = (f: Field | undefined, name: string): [ReactNode, string] | null => (f ? [f.value.trim() ? <Value md={f.value} /> : t('c.none'), name] : null)
  return {
    used: [cards, ...fields],
    body: (
      <>
        <Stats items={[[cards.items.length, t('principles')], fig(version, t('c.version')), fig(ratified, t('c.ratified')), fig(amended, t('c.amended'))]} />
        <Sec title={<Title>{cards.heading}</Title>} note={t('n.count', cards.items.length)}>
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
          const items = b.items.filter(f => ![version, ratified, amended].includes(f)) // drawn above as figures
          // The version line may stand alone, with no heading of its own: then there is no title band to draw, and no sheet if nothing is left.
          if (!b.heading.trim()) return items.length || b.rest.trim() ? <section key={i} className="sec"><FieldsSheet items={items} /><Rich md={b.rest} /></section> : null
          return <Sec key={i} title={<Title>{b.heading}</Title>} note={t('n.items', items.length)}><FieldsSheet items={items} /><Rich md={b.rest} /></Sec>
        })}
      </>
    ),
  }
}
