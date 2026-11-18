import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { CheckItem, DocRef, Field } from '../server/types.ts'
import { useLang } from './i18n.ts'
import { Markdown } from './Markdown.tsx'
import { markOf, type Seen } from './seen.ts'

// Titles carry status emoji (a finished phase ends in a tick); whether it is done is drawn by the marks instead.
export const clean = (s: string) => s.replace(/\p{Extended_Pictographic}️?/gu, '').replace(/\s{2,}/g, ' ').trim()
// "IV. Reliability" or "2a. EnvReference" -> its own number and the name; otherwise the position.
export function splitNo(title: string, n: number): [string, string] {
  const m = clean(title).match(/^(?:Decision\s+)?(\d+[a-z]?|[IVX]+)[.:]\s+(.*)$/)
  return m ? [m[1], m[2]] : [String(n + 1), clean(title)]
}
// The first field with this label, as the object itself: what was drawn is told apart by identity, so a repeated label is never dropped.
export const fieldOf = (items: Field[], label: string) => items.find(f => f.label.toLowerCase() === label.toLowerCase())
export const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties

export const Title = ({ children }: { children: string }) => <Markdown heading>{clean(children)}</Markdown>
export const Rich = ({ md }: { md: string | null | undefined }) => (md?.trim() ? <div className="rich"><Markdown>{md}</Markdown></div> : null)
// One line stays inline; anything with blocks (lists, code, tables) is laid out as blocks.
export const Value = ({ md }: { md: string }) => (md.includes('\n') ? <Rich md={md} /> : <Markdown inline>{md}</Markdown>)

export function Copy({ cmd }: { cmd: string }) {
  const { t } = useLang()
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!ok) return
    const id = setTimeout(() => setOk(false), 1400)
    return () => clearTimeout(id)
  }, [ok])
  // Fails quietly: no clipboard, no permission, insecure context.
  const copy = () => { try { navigator.clipboard.writeText(cmd).then(() => setOk(true), () => {}) } catch { /* quiet */ } }
  return (
    <button type="button" className={ok ? 'copy ok' : 'copy'} onClick={copy}>
      <span aria-live="polite">{t(ok ? 'copied' : 'copy')}</span>
    </button>
  )
}
export const CmdRow = ({ cmd, big }: { cmd: string; big?: boolean }) => (
  <span className="cmdrow"><code className={big ? 'cmd big' : 'cmd'} title={cmd}>{cmd}</code><Copy cmd={cmd} /></span>
)

export function SeenMark({ docs, seen }: { docs: DocRef[]; seen: Seen }) {
  const { t } = useLang()
  const marks = docs.map(d => markOf(d, seen))
  const mark = marks.includes('changed') ? 'changed' : marks.includes('new') ? 'new' : null
  return mark ? <span className={`seen ${mark}`}>{t(mark)}</span> : null
}

export const Sec = ({ title, note, className, children }: { title: ReactNode; note?: ReactNode; className?: string; children?: ReactNode }) => (
  <section className={className ? `sec ${className}` : 'sec'}>
    <header className="sec-h"><h2>{title}</h2>{note ? <span className="sec-n">{note}</span> : null}</header>
    {children}
  </section>
)

export function Stats({ items, note }: { items: ([ReactNode, string] | null | undefined | false | '')[]; note?: string }) {
  const shown = items.filter((x): x is [ReactNode, string] => !!x)
  return (
    <section className="sec stats" style={cssVars({ '--n': shown.length })}>
      {shown.map(([n, label], i) => <div key={i} className="stat"><b>{n}</b><span>{label}</span></div>)}
      {note && <p className="stat-note">{note}</p>}
    </section>
  )
}

export const Bar = ({ done, total }: { done: number; total: number }) => (
  <span className="bar"><i style={cssVars({ '--v': total ? done / total : 0 })} /></span>
)

export const FieldsSheet = ({ items }: { items: Field[] }) => (items.length === 0 ? null : (
  <dl className="spec">
    {items.map((f, i) => <div key={i}><dt>{f.label}</dt><dd><Value md={f.value} /></dd></div>)}
  </dl>
))

export const IdRows = ({ items }: { items: { id: string; text: string }[] }) => (
  <ol className="ids">
    {items.map((it, i) => (
      <li key={i} className={it.text.includes('NEEDS CLARIFICATION') ? 'clarify' : undefined}>
        <code>{it.id}</code><div><Value md={it.text} /></div>
      </li>
    ))}
  </ol>
)

export const Tick = ({ on }: { on: boolean }) => <i className={on ? 'tick on' : 'tick'} aria-hidden />

// One task: filled = done, outline = open; the accent only marks what is next.
export function Mark({ item, next }: { item: CheckItem; next?: boolean }) {
  const { t } = useLang()
  const state = item.done ? t('t.done') : next ? t('t.next') : t('t.open')
  return (
    <span className={(item.done ? 'mk done' : next ? 'mk next' : 'mk') + (item.optional ? ' opt' : '')} title={`${item.id ?? ''} ${state}${item.parallel ? ` · ${t('t.par')}` : ''}${item.optional ? ` · ${t('t.opt')}` : ''}`.trim()}>
      {item.parallel ? 'P' : ''}
    </span>
  )
}

export function TaskTags({ item }: { item: CheckItem }) {
  const { t } = useLang()
  return <span className="trow-tags">{item.parallel && <i>{t('t.partag')}</i>}{item.story && <i>{item.story}</i>}{item.optional && <i>{t('t.opt')}</i>}</span>
}

export function TaskRows({ items, next }: { items: CheckItem[]; next?: Set<CheckItem> }) {
  const { t } = useLang()
  return (
    <ol className="trows">
      {items.map((x, i) => (
        <li key={i} className={x.done ? 'done' : next?.has(x) ? 'next' : undefined}>
          <Mark item={x} next={next?.has(x)} />
          <span className="sr">{t(x.done ? 't.done' : next?.has(x) ? 't.next' : 't.open')}</span>
          <code>{x.id ?? ''}</code>
          <TaskTags item={x} />
          <div><Value md={x.text} />{x.notes && <Rich md={x.notes} />}</div>
        </li>
      ))}
    </ol>
  )
}
