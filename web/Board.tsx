import { useEffect, useState } from 'react'
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
    case 'first': return t('g.first')
    case 'wait': return t('g.wait')
    case 'new': return t('g.new', g.n)
    case 'implement': return t('g.impl', g.left)
    case 'move': return t('g.move', g.n, t(`n.${STAGES[i + 1]}`)) + (g.clarify && g.cmd !== CMD.clarify ? `. ${t('g.clarify', g.clarify, CMD.clarify)}` : '')
  }
}

function Sheet({ f, wide, seen }: { f: Feature; wide: boolean; seen: Seen }) {
  const [no, ...rest] = f.id.split('-')
  const name = rest.length ? rest.join('-') : ''
  return (
    <a className={wide ? (busy(f) ? 'fs wide on' : 'fs wide') : 'fs'} href={stageHref(f.stage, f.id)} title={f.id}>
      <b>{no}</b><span className="fs-name">{name}</span><SeenMark docs={f.docs} seen={seen} />
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
  const stack = STACK[stage].map((kind): [string, number] => [KIND_FILE[kind], kind === 'constitution' ? (project.constitution ? 1 : 0)
    : project.features.reduce((n, f) => n + f.docs.filter(d => d.kind === kind).length, 0)])
  // The card opens the document of a feature standing here (the one being worked on first); an empty stage falls back to the default.
  const front = here.find(busy) ?? here[0]
  return (
    <article className={live ? 'region live' : 'region'} data-i={i} style={cssVars({ '--i': i })}>
      <div className="tag"><b>{i + 1} / 6</b>{t(`n.${stage}`)}{live && <span className="tag-live">{t('live')}</span>}</div>
      <div className="frame">
        {live && <><i className="hd a" /><i className="hd b" /><i className="hd c" /><i className="hd d" /></>}
        <div className="fh">
          <div className="rh">
            <span className="rh-no">{i + 1}</span>
            <div><a className="stage-link" href={stageHref(stage, front?.id)}><strong>{t(`n.${stage}`)}</strong></a><p>{t(`say.${stage}`)}</p></div>
            <Zoom />
          </div>
          <span className="fh-cmd"><span>{t('cmd.stage')}</span><code className={cmd ? 'cmd' : 'cmd none'}>{cmd ?? t('nocmd')}</code></span>
        </div>
        <dl className="figs">
          {stage === 'constitution'
            ? <><div><dt>{t('principles')}</dt><dd>{project.principles.length}</dd></div><div><dt>{t('follows')}</dt><dd>{project.features.length}</dd></div></>
            : <><div><dt>{t('here')}</dt><dd>{here.length}</dd></div><div><dt>{t('passed')}</dt><dd>{count.passed}</dd></div></>}
        </dl>
        {stage === 'constitution' ? (
          <div className="blk feat">
            <div className="lbl">{t('principles')}{project.constitutionVersion && ` · v${project.constitutionVersion}`}
              {project.constitution && <SeenMark docs={[project.constitution]} seen={seen} />}</div>
            {project.principles.length
              ? <ol className="pr">{project.principles.map((p, n) => <li key={n} title={p}>{p}</li>)}</ol>
              : <p className="none">{project.constitution ? t('n.count', 0) : t('pr.none')}</p>}
          </div>
        ) : (
          <div className="blk feat">
            <div className="lbl">{t('feat.here')}</div>
            {here.length ? <>
              <ul className={few ? 'sheets few' : 'sheets'}>
                {here.slice(0, open ? undefined : MAX_SHEETS).map(f => <li key={f.id}><Sheet f={f} wide={few && !!f.tasks?.total} seen={seen} /></li>)}
              </ul>
              {extra > 0 && <button className="morebtn" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t('fold') : t('more.n', extra)}</button>}
            </> : <p className="none">{t('feat.none')}</p>}
          </div>
        )}
        <div className="blk">
          <div className="lbl">{t('docs')}</div>
          <ul className="stack">{stack.map(([file, n]) => <li key={file}><i className="pg" /><span>{file}</span><b>×{n}</b></li>)}</ul>
        </div>
        <div className={g.kind === 'wait' ? 'foot idle' : 'foot'}><span className="lbl">{t('nextcmd')}</span><CmdRow cmd={g.cmd} /><p>{why(g, i, t)}</p></div>
      </div>
      {i < 5 && <svg className={nextLive ? 'flow on' : 'flow'} viewBox="0 0 28 10" aria-hidden="true"><path d="M0 5H26M22 1l4 4-4 4" /></svg>}
    </article>
  )
}

// One zone, six stage cards. Before the project has loaded, the same six cards as outlines.
export function Board({ project, seen }: { project: Project | null; seen: Seen }) {
  const { t } = useLang()
  const counts = project && stageCounts(project)
  // The cards land once, when the project first arrives; un-hiding the board later must not replay it.
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (!project) return
    const id = setTimeout(() => setIntro(false), 1600)
    return () => clearTimeout(id)
  }, [!project])
  return (
    <>
      <h1 className="sr">{project ? t('board', project.name) : t('loading')}</h1>
      <section className={intro && project ? 'zone stages intro' : 'zone stages'} aria-busy={!project}>
        <header className="zone-h">
          <h2>{t('zone')}</h2>
          <p>{project && !project.features.length ? t('zone.empty', CMD.specify) : t('zone.hint')}</p>
        </header>
        <div className="regions">
          {STAGES.map((stage, i) => project && counts
            ? <Region key={stage} project={project} stage={stage} i={i} count={counts[i]} nextLive={!!counts[i + 1]?.live} seen={seen} />
            : <article key={stage} className="region skel-card"><div className="tag"><b>{i + 1} / 6</b>{t(`n.${stage}`)}</div><div className="frame"><span className="skel skel-head" /><span className="skel skel-line" /><span className="skel skel-line" /></div></article>)}
        </div>
      </section>
    </>
  )
}
