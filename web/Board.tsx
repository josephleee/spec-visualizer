import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Feature, Project } from '../server/types.ts'
import { busy, stageCommand, stageCounts, stageGuide, type StageCount, type StageGuide } from './guide.ts'
import { bootFlow, flowOf, type Flow } from './flows.ts'
import { useLang, type T } from './i18n.ts'
import { CmdRow, SeenMark, cssVars } from './parts.tsx'
import { kindFile, projectDocs, stageHref, type StageKey } from './route.ts'
import type { Seen } from './seen.ts'

const MAX_SHEETS = 8
export const Zoom = () => <svg className="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v8M3 7h8M11.5 11.5L15 15" /></svg>

function why(g: StageGuide, i: number, t: T, flow: Flow): string {
  switch (g.kind) {
    case 'constitution': return t('g.const')
    case 'first': return t(flow.setup ? 'g.first' : 'g.start')
    case 'wait': return t('g.wait')
    case 'new': return t('g.new', g.n)
    case 'implement': return t('g.impl', g.left)
    case 'move': return t('g.move', g.n, t(`n.${flow.stages[i + 1].key}`)) + (g.clarify && flow.clarify && g.cmd !== flow.clarify ? `. ${t('g.clarify', g.clarify, flow.clarify)}` : '')
  }
}

// A list that may be taller than its card: it scrolls inside, and a fade at an edge says there is more that way.
function Scroller({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const box = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ up: false, down: false })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const read = () => {
      const up = el.scrollTop > 1, down = el.scrollTop + el.clientHeight < el.scrollHeight - 1
      setMore(m => (m.up === up && m.down === down ? m : { up, down }))
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    const watch = new ResizeObserver(read)
    watch.observe(el)
    if (el.firstElementChild) watch.observe(el.firstElementChild)
    return () => { el.removeEventListener('scroll', read); watch.disconnect() }
  }, [])
  return (
    <div className={`scroller${more.up ? ' up' : ''}${more.down ? ' down' : ''}`}>
      <div className="scroller-box" ref={box}>{children}</div>
      {more.down && <span className="sr">{t('scroll.more')}</span>}
    </div>
  )
}

// spec-kit folders start with a number: it stands apart. Other formats name their units with words, so the name is shown
// whole; an archived OpenSpec change drops its date prefix here (the archive card lists them newest first, the full id is the tooltip).
export function sheetName(id: string, flow: Flow): [string, string] {
  if (flow.id === 'spec-kit') { const [no, ...rest] = id.split('-'); return [no, rest.length ? rest.join('-') : ''] }
  return ['', id.replace(/^archive\/\d{4}-\d{2}-\d{2}-/, '')]
}

function Sheet({ f, wide, seen, flow }: { f: Feature; wide: boolean; seen: Seen; flow: Flow }) {
  const { t } = useLang()
  const [no, name] = sheetName(f.id, flow)
  return (
    <a className={wide ? (busy(f) ? 'fs wide on' : 'fs wide') : 'fs'} href={stageHref(f.stage, f.id)} title={f.id}>
      {flow.id === 'spec-kit' && <b>{no}</b>}<span className="fs-name">{name}</span>
      {f.docs.some(d => d.error) ? <span className="seen err">{t('err.read')}</span> : <SeenMark docs={f.docs} seen={seen} />}
      {wide && f.tasks && <>
        <span className="fs-bar"><i style={cssVars({ '--v': f.tasks.total ? f.tasks.done / f.tasks.total : 0 })} /></span>
        <span className="fs-n">{f.tasks.done} / {f.tasks.total}</span>
      </>}
    </a>
  )
}

function Region({ project, stage, i, count, nextLive, seen }: { project: Project; stage: StageKey; i: number; count: StageCount; nextLive: boolean; seen: Seen }) {
  const { t } = useLang()
  const flow = flowOf(project), n = flow.stages.length, def = flow.stages[i]
  const first = i === 0
  const [open, setOpen] = useState(false)
  const { here, live } = count
  const g = stageGuide(project, stage), cmd = stageCommand(stage, flow)
  const few = here.length < 3, extra = here.length - MAX_SHEETS
  // Per kind: the documents that could be read, and how many could not.
  const stack = def.kinds.map(kind => {
    const docs = first ? projectDocs(project, [kind]) : project.features.flatMap(f => f.docs.filter(d => d.kind === kind))
    return { file: kindFile(kind, flow), n: docs.filter(d => !d.error).length, bad: docs.filter(d => d.error).length }
  })
  // What the project stage lists: the principles (spec-kit), the capabilities (OpenSpec) or the steering files (Kiro).
  const shared = projectDocs(project, def.kinds.slice(0, 1)).filter(d => d.kind !== 'constitution')
  const items = flow.id === 'spec-kit' ? project.principles : shared.map(d => d.path.split('/').slice(d.kind === 'capability' ? -2 : -1)[0].replace(/\.md$/, ''))
  // The card opens the document of a feature standing here (the one being worked on first); an empty stage falls back to the default.
  const front = here.find(busy) ?? here[0]
  const name = t(`n.${stage}`)
  return (
    <article className={live ? 'region live' : 'region'} data-i={i}>
      <div className="tag"><b>{i + 1}{` / ${n}`}</b><span className="tag-name">{name}</span>{live && <span className="tag-live">{t('live')}</span>}</div>
      <div className="frame">
        {live && <><i className="hd a" /><i className="hd b" /><i className="hd c" /><i className="hd d" /></>}
        <div className="fh">
          <div className="rh">
            <span className="rh-no">{i + 1}</span>
            <a className="stage-link" href={stageHref(stage, front?.id)} title={name}><strong>{name}</strong></a>
            <Zoom />
          </div>
          <span className="fh-cmd"><span>{t('cmd.stage')}</span><code className={cmd ? 'cmd' : 'cmd off'} title={cmd ?? undefined}>{cmd ?? t('nocmd')}</code></span>
        </div>
        <dl className="figs">
          {first
            ? <><div><dt>{t(flow.labels.items)}</dt><dd>{items.length}</dd></div><div><dt>{t(flow.id === 'spec-kit' ? 'follows' : 'f.feats')}</dt><dd>{project.features.length}</dd></div></>
            : <><div><dt>{t('here')}</dt><dd>{here.length}</dd></div><div><dt>{t('passed')}</dt><dd>{count.passed}</dd></div></>}
        </dl>
        {first ? (
          <div className="blk feat">
            <div className="lbl">{t(flow.labels.items)}{project.constitutionVersion && ` · v${project.constitutionVersion}`}
              {project.constitution?.error ? <span className="seen err">{t('err.read')}</span> : project.constitution && <SeenMark docs={[project.constitution]} seen={seen} />}
              {shared.some(d => d.error) ? <span className="seen err">{t('err.read')}</span> : <SeenMark docs={shared} seen={seen} />}</div>
            {items.length
              ? <Scroller><ol className="pr">{items.map((p, n) => <li key={n} title={p}>{p}</li>)}</ol></Scroller>
              : <p className="none">{project.constitution ? t('n.count', 0) : t(flow.labels.none)}</p>}
          </div>
        ) : (
          <div className="blk feat">
            <div className="lbl">{t('feat.here')}</div>
            {here.length ? <>
              <Scroller>
                <ul className={few ? 'sheets few' : 'sheets'}>
                  {here.slice(0, open ? undefined : MAX_SHEETS).map(f => <li key={f.id}><Sheet f={f} wide={few && !!f.tasks?.total} seen={seen} flow={flow} /></li>)}
                </ul>
              </Scroller>
              {/* The toggle sits outside the scrolling list, so it stays in sight however long the list gets. */}
              {extra > 0 && <button className="morebtn" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('fold') : t('more.n', extra)}</button>}
            </> : <p className="none">{t('feat.none')}</p>}
          </div>
        )}
        <div className="blk">
          <div className="lbl">{t('docs')}</div>
          <ul className="stack">
            {stack.map(s => <li key={s.file}><i className="pg" /><span title={s.file}>{s.file}</span>{s.bad > 0 && <em className="seen err" title={t('err.read')}>{t('err.read')} {s.bad}</em>}<b>×{s.n}</b></li>)}
          </ul>
        </div>
        <div className={g.kind === 'wait' ? 'foot idle' : 'foot'}><span className="lbl">{t('nextcmd')}</span><CmdRow cmd={g.cmd} /><p>{why(g, i, t, flow)}</p></div>
      </div>
      {i < n - 1 && <svg className={nextLive ? 'flow on' : 'flow'} viewBox="0 0 28 10" aria-hidden="true"><path d="M0 5H26M22 1l4 4-4 4" /></svg>}
    </article>
  )
}

// One zone, one card per stage. Before the project has loaded, the same cards as outlines, each where its card will be.
export function Board({ project, seen }: { project: Project | null; seen: Seen }) {
  const { t } = useLang()
  const counts = project && stageCounts(project)
  const flow = project ? flowOf(project) : bootFlow(), n = flow.stages.length
  return (
    <>
      <h1 className="sr" tabIndex={-1}>{project ? t('board', project.name) : t('loading')}</h1>
      <section className="zone stages" aria-busy={!project}>
        <header className="zone-h">
          <h2>{n === 6 ? t('zone') : t('zone.n', n)}</h2>
          {project && !project.features.length && <p>{t('zone.empty', flow.start)}</p>}
        </header>
        <div className="regions" style={n === 6 ? undefined : cssVars({ '--stages': n })}>
          {flow.stages.map(({ key: stage }, i) => project && counts
            ? <Region key={stage} project={project} stage={stage} i={i} count={counts[i]} nextLive={!!counts[i + 1]?.live} seen={seen} />
            : <article key={stage} className="region skel-card"><div className="tag"><b>{i + 1}{` / ${n}`}</b><span className="tag-name">{t(`n.${stage}`)}</span></div><div className="frame"><span className="skel skel-head" /><span className="skel skel-line" /><span className="skel skel-line" /></div></article>)}
        </div>
      </section>
    </>
  )
}
