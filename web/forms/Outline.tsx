import type { ReactNode } from 'react'
import type { Block, ParsedDoc } from '../../server/types.ts'
import type { T } from '../i18n.ts'
import { FieldsSheet, IdRows, Rich, Sec, Stats, TaskRows, Title, clean } from '../parts.tsx'
import { Decisions } from './PlanDocs.tsx'
import { Stories } from './Spec.tsx'
import { hasBody } from './types.ts'

const headOf = (b: Block, t: T) => clean(('heading' in b ? b.heading : 'title' in b ? b.title : null) ?? '') || t('o.intro')

// Any block, drawn plainly. Every kind has a form here, so nothing is ever dropped.
export function Generic({ b }: { b: Block }) {
  switch (b.kind) {
    case 'raw': return <Rich md={b.markdown} />
    case 'fields': return <><FieldsSheet items={b.items} /><Rich md={b.rest} /></>
    case 'idList': return <><IdRows items={b.items} /><Rich md={b.rest} /></>
    case 'code': return <>{b.lang && <span className="lbl">{b.lang}</span>}<pre className="code" tabIndex={0}><code>{b.text}</code></pre></>
    case 'cards': return <>{b.items.map((c, i) => <div key={i} className="sub"><h4><Title>{c.title}</Title></h4><Rich md={c.markdown} /></div>)}</>
    case 'phase': return <><FieldsSheet items={b.fields} /><TaskRows items={b.items} /><Rich md={b.rest} /></>
    case 'stories': return <Stories items={b.items} />
    case 'decisions': return <Decisions items={b.items} />
  }
}

// Blocks the form did not draw: say how many, keep them one click away.
export function More({ blocks, t }: { blocks: Block[]; t: T }) {
  // A heading with nothing under it is still shown, as its heading line; only a block with neither is nothing.
  const left = blocks.filter(b => hasBody(b) || (b.kind === 'raw' && b.heading))
  if (!left.length) return null
  return (
    <section className="sec more">
      <details>
        <summary><b>{t('more.blocks', left.length)}</b><span>{left.map((b, i) => <span key={i}>{i > 0 && ' · '}<Title>{headOf(b, t)}</Title></span>)}</span></summary>
        {left.map((b, i) => <div key={i} className="more-b"><h3><Title>{headOf(b, t)}</Title></h3><Generic b={b} /></div>)}
      </details>
    </section>
  )
}

// A document without the expected structure: its own sections in its own order, one sheet per top heading.
export function outline(doc: ParsedDoc, t: T, offTemplate: boolean): ReactNode {
  const groups: { b: Block; kids: Block[] }[] = []
  for (const b of doc.blocks) {
    if (b.kind === 'raw' && b.depth > 2 && groups.length) groups[groups.length - 1].kids.push(b)
    else groups.push({ b, kids: [] })
  }
  return (
    <>
      {offTemplate && <Stats items={[[groups.length, t('o.sections')], [doc.blocks.filter(hasBody).length, t('o.blocks')]]} note={t('o.note')} />}
      {groups.map((g, i) => (
        <Sec key={i} title={<Title>{headOf(g.b, t)}</Title>} note={g.kids.length ? t('o.sub', g.kids.length) : null}>
          <Generic b={g.b} />
          {g.kids.length > 0 && (
            <div className="subs">
              {g.kids.map((k, j) => <article key={j} className="sub"><h3><Title>{headOf(k, t)}</Title></h3><Generic b={k} /></article>)}
            </div>
          )}
        </Sec>
      ))}
    </>
  )
}
