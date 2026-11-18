import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DocKind, Feature, Project } from '../server/types.ts'
import { CMD, busy, stageCommand, stageCounts, stageGuide, type StageCount, type StageGuide } from './guide.ts'
import { useLang, type T } from './i18n.ts'
import { CmdRow, SeenMark, cssVars } from './parts.tsx'
import { KIND_FILE, STAGES, stageHref, type StageKey } from './route.ts'
import type { Seen } from './seen.ts'

const MAX_SHEETS = 8
// The documents each stage leaves.
const STACK: Record<StageKey, DocKind[]> = {
  constitution: ['constitution'], specify: ['spec'], plan: ['plan', 'research', 'data-model', 'quickstart', 'contract'],
  tasks: ['tasks'], implement: ['tasks'], done: ['checklist'],
}
export const Zoom = () => <svg className="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3v8M3 7h8M11.5 11.5L15 15" /></svg>

function why(g: StageGuide, i: number, t: T): string {
  switch (g.kind) {
    case 'constitution': return t('g.const')
    case 'first': return t('g.first')
    case 'wait': return t('g.wait')
    case 'new': return t('g.new', g.n)
    case 'implement': return t('g.impl', g.left)
    case 'move': return t('g.move', g.n, t(`n.${STAGES[i + 1]}`)) + (g.clarify && g.cmd !== CMD.clarify ? `. ${t('g.clarify', g.clarify, CMD.clarify)}` : '')
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

function Sheet({ f, wide, seen }: { f: Feature; wide: boolean; seen: Seen }) {
  const { t } = useLang()
  const [no, ...rest] = f.id.split('-')
  const name = rest.length ? rest.join('-') : ''
  return (
    <a className={wide ? (busy(f) ? 'fs wide on' : 'fs wide') : 'fs'} href={stageHref(f.stage, f.id)} title={f.id}>
      <b>{no}</b><span className="fs-name">{name}</span>
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
  const [open, setOpen] = useState(false)
  const { here, live } = count
  const g = stageGuide(project, stage), cmd = stageCommand(stage)
  const few = here.length < 3, extra = here.length - MAX_SHEETS
  // Per kind: the documents that could be read, and how many could not.
  const stack = STACK[stage].map(kind => {
    const docs = kind === 'constitution' ? (project.constitution ? [project.constitution] : []) : project.features.flatMap(f => f.docs.filter(d => d.kind === kind))
    return { file: KIND_FILE[kind], n: docs.filter(d => !d.error).length, bad: docs.filter(d => d.error).length }
  })
  // The card opens the document of a feature standing here (the one being worked on first); an empty stage falls back to the default.
  const front = here.find(busy) ?? here[0]
  const name = t(`n.${stage}`)
  return (
    <article className={live ? 'region live' : 'region'} data-i={i}>
      <div className="tag"><b>{i + 1} / 6</b><span className="tag-name">{name}</span>{live && <span className="tag-live">{t('live')}</span>}</div>
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
          {stage === 'constitution'
            ? <><div><dt>{t('principles')}</dt><dd>{project.principles.length}</dd></div><div><dt>{t('follows')}</dt><dd>{project.features.length}</dd></div></>
            : <><div><dt>{t('here')}</dt><dd>{here.length}</dd></div><div><dt>{t('passed')}</dt><dd>{count.passed}</dd></div></>}
        </dl>
        {stage === 'constitution' ? (
          <div className="blk feat">
            <div className="lbl">{t('principles')}{project.constitutionVersion && ` · v${project.constitutionVersion}`}
              {project.constitution?.error ? <span className="seen err">{t('err.read')}</span> : project.constitution && <SeenMark docs={[project.constitution]} seen={seen} />}</div>
            {project.principles.length
              ? <Scroller><ol className="pr">{project.principles.map((p, n) => <li key={n} title={p}>{p}</li>)}</ol></Scroller>
              : <p className="none">{project.constitution ? t('n.count', 0) : t('pr.none')}</p>}
          </div>
        ) : (
          <div className="blk feat">
            <div className="lbl">{t('feat.here')}</div>
            {here.length ? <>
              <Scroller>
                <ul className={few ? 'sheets few' : 'sheets'}>
                  {here.slice(0, open ? undefined : MAX_SHEETS).map(f => <li key={f.id}><Sheet f={f} wide={few && !!f.tasks?.total} seen={seen} /></li>)}
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
        <div className={g.kind === 'wait' ? 'foot idle' : 'foot'}><span className="lbl">{t('nextcmd')}</span><CmdRow cmd={g.cmd} /><p>{why(g, i, t)}</p></div>
      </div>
      {i < 5 && <svg className={nextLive ? 'flow on' : 'flow'} viewBox="0 0 28 10" aria-hidden="true"><path d="M0 5H26M22 1l4 4-4 4" /></svg>}
    </article>
  )
}

// One zone, six stage cards. Before the project has loaded, the same six cards as outlines, each where its card will be.
export function Board({ project, seen }: { project: Project | null; seen: Seen }) {
  const { t } = useLang()
  const counts = project && stageCounts(project)
  return (
    <>
      <h1 className="sr" tabIndex={-1}>{project ? t('board', project.name) : t('loading')}</h1>
      <section className="zone stages" aria-busy={!project}>
        <header className="zone-h">
          <h2>{t('zone')}</h2>
          {project && !project.features.length && <p>{t('zone.empty', CMD.specify)}</p>}
        </header>
        <div className="regions">
          {STAGES.map((stage, i) => project && counts
            ? <Region key={stage} project={project} stage={stage} i={i} count={counts[i]} nextLive={!!counts[i + 1]?.live} seen={seen} />
            : <article key={stage} className="region skel-card"><div className="tag"><b>{i + 1} / 6</b><span className="tag-name">{t(`n.${stage}`)}</span></div><div className="frame"><span className="skel skel-head" /><span className="skel skel-line" /><span className="skel skel-line" /></div></article>)}
        </div>
      </section>
    </>
  )
}
