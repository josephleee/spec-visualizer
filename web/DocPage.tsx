import { useEffect, useRef, useState } from 'react'
import type { Block, CheckItem, Field, ParsedDoc, Project } from '../server/types.ts'
import { useLang } from './i18n.ts'
import { latestOnly, settle, type Loaded } from './live.ts'
import { Markdown } from './Markdown.tsx'
import { markSeen, type Seen } from './seen.ts'

type B<K extends Block['kind']> = Extract<Block, { kind: K }>

const clarify = (s: string) => s.includes('NEEDS CLARIFICATION')
const level = (depth: number) => (depth >= 4 ? 'h4' : depth === 3 ? 'h3' : 'h2')
const Rest = ({ md }: { md: string }) => (md ? <Markdown>{md}</Markdown> : null)
const Fields = ({ items }: { items: Field[] }) => (items.length === 0 ? null : (
  <dl className="fields">
    {items.map((f, i) => (
      <div key={i} className={clarify(f.value) ? 'clarify' : undefined}>
        <dt>{f.label}</dt><dd><Markdown inline>{f.value}</Markdown></dd>
      </div>
    ))}
  </dl>
))
function Bar({ done, total }: { done: number; total: number }) {
  const { t } = useLang()
  return <span className="bar">{total > 0 && <progress max={total} value={done} aria-label={t('progress')} />} {done}/{total}</span>
}

function Stories({ b }: { b: B<'stories'> }) {
  const rank = (p: string | null) => (p ? Number(p.replace(/\D/g, '')) || 99 : 100)
  const items = [...b.items].sort((a, c) => rank(a.priority) - rank(c.priority))
  return (
    <>
      {items.map((s, i) => (
        <article key={i} className="card story">
          <h3>{s.priority && <span className="badge">{s.priority}</span>} {s.title}</h3>
          {s.why && <div><strong>Why this priority</strong> <Markdown inline>{s.why}</Markdown></div>}
          {s.test && <div><strong>Independent Test</strong> <Markdown inline>{s.test}</Markdown></div>}
          {s.scenarios.map((sc, j) => (
            <dl key={j} className="scenario">
              <dt>Given</dt><dd><Markdown inline>{sc.given}</Markdown></dd>
              <dt>When</dt><dd><Markdown inline>{sc.when}</Markdown></dd>
              <dt>Then</dt><dd><Markdown inline>{sc.then}</Markdown></dd>
            </dl>
          ))}
          <Rest md={s.rest} />
        </article>
      ))}
    </>
  )
}

function IdList({ b }: { b: B<'idList'> }) {
  const H = level(b.depth)
  return (
    <section>
      <H>{b.heading}</H>
      <ul className="idlist">
        {b.items.map((it, i) => (
          <li key={i} className={clarify(it.text) ? 'clarify' : undefined}>
            <code className="id">{it.id}</code> <Markdown inline>{it.text}</Markdown>
          </li>
        ))}
      </ul>
      <Rest md={b.rest} />
    </section>
  )
}

function Phase({ b, story, onStory }: { b: B<'phase'>; story: string | null; onStory: (s: string) => void }) {
  const { t } = useLang()
  const items: CheckItem[] = story ? b.items.filter(i => i.story === story) : b.items
  return (
    <section className="phase">
      <h2>{b.title}</h2>
      <Bar done={b.items.filter(i => i.done).length} total={b.items.length} />
      <Fields items={b.fields} />
      <ul className="items">
        {items.map((it, i) => (
          <li key={i} className={it.done ? 'done' : undefined}>
            <span className="check" aria-hidden /><span className="sr-only">{t(it.done ? 'itemDone' : 'itemOpen')}</span> {it.id && <code className="id">{it.id}</code>}{' '}
            <Markdown inline>{it.text}</Markdown>
            {it.parallel && <span className="badge"> [P]</span>}
            {it.story && <button type="button" className="badge" onClick={() => onStory(it.story!)}>{it.story}</button>}
          </li>
        ))}
      </ul>
      <Rest md={b.rest} />
    </section>
  )
}

function FieldsBlock({ b }: { b: B<'fields'> }) {
  return <section><h2>{b.heading}</h2><Fields items={b.items} /><Rest md={b.rest} /></section>
}

function Cards({ b }: { b: B<'cards'> }) {
  return (
    <section>
      <h2>{b.heading}</h2>
      <div className="grid">
        {b.items.map((c, i) => <article key={i} className="card"><h3>{c.title}</h3><Markdown>{c.markdown}</Markdown></article>)}
      </div>
    </section>
  )
}

function Decisions({ b }: { b: B<'decisions'> }) {
  return (
    <>
      {b.items.map((d, i) => {
        const main = d.fields.find(f => f.label === 'Decision')
        return (
          <article key={i} className="card">
            <h3>{d.title}</h3>
            {main && <div className="decision"><Markdown>{main.value}</Markdown></div>}
            <Fields items={d.fields.filter(f => f !== main)} />
            <Rest md={d.rest} />
          </article>
        )
      })}
    </>
  )
}

function Raw({ b }: { b: B<'raw'> }) {
  const H = level(b.depth)
  return <section>{b.heading && <H>{b.heading}</H>}{b.markdown && <Markdown>{b.markdown}</Markdown>}</section>
}

function Code({ b }: { b: B<'code'> }) {
  return <pre><code className={b.lang ? `language-${b.lang}` : undefined}>{b.text}</code></pre>
}

function Body({ doc }: { doc: ParsedDoc }) {
  const { t } = useLang()
  const [story, setStory] = useState<string | null>(null)
  const phases = doc.blocks.filter((b): b is B<'phase'> => b.kind === 'phase')
  const all = phases.flatMap(p => p.items)
  const stories = [...new Set(all.map(i => i.story).filter((s): s is string => !!s))]
  if (story && !stories.includes(story)) setStory(null) // a refetch removed the selected story
  return (
    <>
      {doc.ref.kind === 'tasks' && <p className="summary"><strong>{t('tasks')}</strong> <Bar done={all.filter(i => i.done).length} total={all.length} /></p>}
      {stories.length > 0 && (
        <div className="filter" role="group" aria-label={t('storyFilter')}>
          <button type="button" aria-pressed={story === null} onClick={() => setStory(null)}>{t('all')}</button>
          {stories.map(s => <button key={s} type="button" aria-pressed={story === s} onClick={() => setStory(s)}>{s}</button>)}
        </div>
      )}
      {doc.blocks.map((b, i) => {
        switch (b.kind) {
          case 'stories': return <Stories key={i} b={b} />
          case 'idList': return <IdList key={i} b={b} />
          case 'phase': return <Phase key={i} b={b} story={story} onStory={setStory} />
          case 'fields': return <FieldsBlock key={i} b={b} />
          case 'cards': return <Cards key={i} b={b} />
          case 'decisions': return <Decisions key={i} b={b} />
          case 'raw': return <Raw key={i} b={b} />
          case 'code': return <Code key={i} b={b} />
        }
      })}
    </>
  )
}

export function DocPage({ path, project, version, onSeen }: {
  path: string; project: Project; version: number; onSeen: (s: Seen) => void
}) {
  const { t } = useLang()
  const [result, setResult] = useState<Loaded<ParsedDoc> | null>(null)
  // One shared guard so a slow older response never overwrites a newer one.
  const apply = useRef<ReturnType<typeof latestOnly<Loaded<ParsedDoc>>>>(null)
  apply.current ??= latestOnly<Loaded<ParsedDoc>>(next => setResult(prev => settle(prev, next)))

  useEffect(() => {
    apply.current!(fetch(`/api/doc?path=${encodeURIComponent(path)}`).then(async r => {
      if (r.status === 404) return { path, doc: null }
      if (!r.ok) throw new Error(String(r.status))
      return { path, doc: await r.json() as ParsedDoc }
    }).catch(() => ({ path, doc: null, failed: true })))
  }, [path, version])

  const mine = result?.path === path ? result : null
  const doc = mine ? mine.doc : undefined // undefined = not loaded yet
  const hash = doc?.ref.hash
  useEffect(() => { if (doc) onSeen(markSeen(project.root, doc.ref)) }, [path, hash])

  const ref = [project.constitution, ...project.features.flatMap(f => f.docs)].find(d => d?.path === path)
  const feature = project.features.find(f => f.docs.some(d => d.path === path))
  const home = <a href="#/">{t('home')}</a>

  if (ref?.error) return <section className="state"><p className="crumb">{home}</p><h1>{path}</h1><p role="alert">{t('readError')}: {ref.error}</p></section>
  if (mine?.failed && !doc) return <section className="state"><p className="crumb">{home}</p><h1>{path}</h1><p role="alert">{t('readError')}</p></section>
  if (doc === null) return <section className="state"><p className="crumb">{home}</p><p role="alert">{t('docGone')}</p></section>
  if (!doc) return <section className="state"><p className="crumb">{home}</p><p>{t('loading')}</p></section>
  return (
    <article className={`doc kind-${doc.ref.kind}`}>
      <p className="crumb">{home}<span>{feature?.id ?? t('constitution')}</span>{feature && <span>{doc.ref.kind}</span>}</p>
      {mine?.failed && <p role="status" className="notice">{t('refreshError')}</p>}
      <h1>{doc.title ?? path}</h1>
      <div className="meta"><Fields items={doc.meta} /></div>
      <Body key={path} doc={doc} />
    </article>
  )
}
