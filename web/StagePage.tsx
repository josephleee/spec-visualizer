import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { DocKind, DocRef, Feature, ParsedDoc, Project } from '../server/types.ts'
import { Zoom } from './Board.tsx'
import { reducedMotion } from './camera.ts'
import { DocMeta, DocTitle, renderDoc } from './forms/render.tsx'
import { CMD, boundFeatures, busy, creatingCommand, missingWhy, nextCommand, stageCommand, stageCounts } from './guide.ts'
import { useLang } from './i18n.ts'
import { CmdRow, SeenMark } from './parts.tsx'
import { KIND_FILE, PLAN_SUBS, STAGES, docHref, featureHref, linkFeature, resolveTarget, stageHref, stageIndex, type Route, type StageKey } from './route.ts'
import { saveScroll, savedScroll } from './scroll.ts'
import { markSeen, type Seen } from './seen.ts'

const fileOf = (d: DocRef) => d.path.split('/').slice(d.kind === 'checklist' || d.kind === 'contract' ? -2 : -1).join('/')

// The page before its first document has arrived: the same bar, index column, header sheet and sheets as the real one.
export const DocSkeleton = () => (
  <>
    <div className="docbar" aria-hidden><span className="skel skel-ctl" /><span className="skel skel-ctl wide" /></div>
    <div className="paper" aria-busy="true">
      <div className="tag"><span className="skel skel-tag" /></div>
      <div className="pgrid">
        <div className="toc"><b>&nbsp;</b><p className="toc-none"><span className="skel skel-line" /></p></div>
        <div className="psheet">
          <header className="phead skel-phead"><span className="skel skel-no" /><span className="skel skel-head" /><span className="skel skel-line" /></header>
          {[0, 1].map(i => <section key={i} className="sec skel-sheet"><span className="skel skel-head" /><span className="skel skel-line" /><span className="skel skel-line" /></section>)}
        </div>
      </div>
    </div>
  </>
)

// A page that has nothing to draw says why, and what to do about it.
const State = ({ title, alert, children }: { title: string; alert?: boolean; children?: ReactNode }) => (
  <section className="sec empty" role={alert ? 'alert' : undefined}><h2>{title}</h2>{children}</section>
)

// The feature has not reached this document yet: where it is, what is missing, what to type.
function Missing({ stage, feature, kind }: { stage: StageKey; feature: Feature | null; kind: DocKind }) {
  const { t } = useLang()
  if (!feature) return <State title={t('e.title')}><p>{t('e.constitution')}</p><dl className="empty-cmds"><div className="now"><dt>{t('e.make')}</dt><dd><CmdRow cmd={CMD.constitution} big /></dd></div></dl></State>
  // A finished feature without a checklist is not behind: it is complete, and there is nothing to type for it.
  if (missingWhy(feature, stage) === 'complete') return <State title={t('e.complete.title')}><p>{t('e.complete', feature.id)}</p></State>
  const next = nextCommand(feature).cmd, make = creatingCommand(kind)
  return (
    <State title={t('e.title')}>
      <p>{t('e.where', feature.id, t(`n.${feature.stage}`), stageIndex(feature) + 1)}</p>
      <p>{t('e.missing', t(`n.${stage}`), KIND_FILE[kind])}</p>
      <dl className="empty-cmds">
        {next && <div className="now"><dt>{t('e.now')}</dt><dd><CmdRow cmd={next} big /></dd></div>}
        {make ? make !== next && <div><dt>{t('e.make')}</dt><dd><CmdRow cmd={make} /></dd></div> : <div><dd>{t('e.nomake')}</dd></div>}
      </dl>
      {feature.stage !== stage && <a className="empty-go" href={stageHref(feature.stage, feature.id)}>{t('e.goto', feature.id, t(`n.${feature.stage}`))} →</a>}
    </State>
  )
}

// A document address with everything it needs already fetched: the page is drawn whole or not at all.
export type DocView = { route: Exclude<Route, { kind: 'board' }>; entry: string; path: string | null; doc: ParsedDoc | null | undefined; failed: boolean }

export function StagePage({ view, asked, project, seen, onSeen, onPick }: {
  view: DocView; asked: Route; project: Project; seen: Seen; onSeen: (s: Seen) => void; onPick: (path: string) => void
}) {
  const { t } = useLang()
  const { route, failed } = view
  const { stage, feature, kind, refs } = resolveTarget(project, route)
  const ref = refs.find(d => d.path === view.path) ?? refs[0] ?? null
  // The fetched document belongs to this page only while the project still points at the same file.
  const doc = ref && ref.path === view.path ? view.doc : undefined
  const hash = doc?.ref.hash
  useEffect(() => { if (doc) onSeen(markSeen(project.root, doc.ref, undefined, seen)) }, [doc?.ref.path, hash])

  const si = stage ? STAGES.indexOf(stage) : -1
  const fid = linkFeature(project, route, feature) // what the stage links carry; the page itself speaks of `feature` only
  const sub = route.kind === 'stage' ? route.sub : null
  const counts = stageCounts(project)
  const cmd = stage && stageCommand(stage), next = feature && nextCommand(feature).cmd
  const name = stage ? t(`n.${stage}`) : ref ? fileOf(ref) : route.kind === 'doc' ? route.path : ''

  // ---------- the section index: read from the sheets that were drawn, so its numbers match their title bands ----------
  const sheet = useRef<HTMLDivElement>(null)
  // The sheets that have a title band (found without :has(), which older browsers throw on).
  const sections = () => [...(sheet.current?.children ?? [])].filter((e): e is HTMLElement => e instanceof HTMLElement && e.classList.contains('sec') && !!e.firstElementChild?.classList.contains('sec-h'))
  const [toc, setToc] = useState<string[]>([])
  const [at, setAt] = useState(0)
  useLayoutEffect(() => {
    const heads = sections().map(s => s.querySelector('h2')?.textContent ?? '')
    setToc(old => (old.length === heads.length && old.every((x, i) => x === heads[i]) ? old : heads))
  })
  useEffect(() => {
    const list = sections()
    if (!list.length) return
    const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setAt(list.indexOf(e.target as HTMLElement)) }),
      { root: sheet.current?.closest('.layer'), rootMargin: '-15% 0px -70% 0px' })
    list.forEach(s => spy.observe(s))
    return () => spy.disconnect()
  }, [toc.join('\n'), doc])
  // Reading position. A history entry seen before (back, forward, reload) returns to where it was left; a new one starts
  // at the top, except after a plan tab or a chooser button: then the row of tabs stays exactly where it was on screen.
  const place = route.kind === 'doc' ? route.path : `${stage}/${feature?.id}`
  const before = useRef<string | null>(null)
  const refocus = useRef<{ control: string; top: number } | null>(null) // the tab or chooser button that asked for this page, and where its row was
  const viaTabs = (control: string) => (e: { currentTarget: Element }) => { refocus.current = { control, top: e.currentTarget.getBoundingClientRect().top } }
  useLayoutEffect(() => {
    const layer = sheet.current?.closest('.layer')
    if (!layer) return
    // The sheets are drawn anew for each page, so the tab or chooser button that was used gets the focus back.
    const via = refocus.current
    refocus.current = null
    if (via) sheet.current?.querySelector<HTMLElement>(via.control)?.focus({ preventScroll: true })
    const saved = savedScroll(view.entry), tabs = via && sheet.current?.querySelector('.tabs')
    if (tabs && before.current === place) layer.scrollTop += tabs.getBoundingClientRect().top - via.top
    else if (saved !== null) layer.scrollTop = saved
    else layer.scrollTop = 0
    before.current = place
    setAt(0)
    let frame = 0
    const save = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => saveScroll(view.entry, layer.scrollTop)) }
    layer.addEventListener('scroll', save, { passive: true })
    return () => { cancelAnimationFrame(frame); layer.removeEventListener('scroll', save) }
  }, [view.entry, view.path])

  const loading = !!ref && !ref.error && doc === undefined
  const bound = boundFeatures(project, stage)
  // While another feature is on its way the select already shows it; everything else stays as it is until the page changes.
  const choosing = asked.kind === 'stage' && asked.stage === stage && project.features.some(x => x.id === asked.feature) ? asked.feature : null

  // ---------- body: one of the states, or the form for this kind of document ----------
  let body: ReactNode
  if (route.kind === 'stage' && stage !== 'constitution' && route.feature && !feature) body = <State title={t('docGone')} alert><p>{t('docGone.say')}</p></State>
  else if (route.kind === 'stage' && stage !== 'constitution' && !feature) body = <State title={t('e.project')}><p>{t('e.project.say')}</p><CmdRow cmd={CMD.specify} big /></State>
  else if (!ref) body = stage ? <Missing stage={stage} feature={feature} kind={kind} /> : <State title={t('docGone')} alert><p>{t('docGone.say')}</p></State>
  else if (ref.error) body = <State title={t('readError')} alert><p>{ref.path}</p><p>{ref.error}</p></State>
  else if (doc === undefined) body = <section className="sec skel-sheet" aria-busy="true"><span className="sr">{t('loading')}</span><span className="skel skel-head" /><span className="skel skel-line" /><span className="skel skel-line" /></section>
  else if (doc === null) body = failed ? <State title={t('readError')} alert><p>{ref.path}</p></State> : <State title={t('docGone')} alert><p>{t('docGone.say')}</p></State>
  else body = renderDoc(doc, kind, stage === 'implement', { feature, t })

  const planTabs = stage === 'plan' && feature
    ? (['plan', ...PLAN_SUBS] as const).filter(k => k !== 'contract' || sub === 'contract' || feature.docs.some(d => d.kind === 'contract'))
    : []
  const step = (i: number, dir: 'prev' | 'next') => (STAGES[i]
    ? <a className={`step ${dir}`} href={stageHref(STAGES[i], fid)}><span>{t(dir)}</span><b>{i + 1} / 6 {t(`n.${STAGES[i]}`)}</b>{stageCommand(STAGES[i]) && <code>{stageCommand(STAGES[i])}</code>}</a>
    : <span className={`step off ${dir}`}>{t(dir === 'prev' ? 'first' : 'last')}</span>)

  return (
    <>
      <div className="docbar">
        <a className="back" href="#/"><Zoom />{t('back')}</a>
        <nav className="cells" aria-label={t('bar.stages')}>
          {STAGES.map((s, i) => (
            <a key={s} className={counts[i].live ? 'cell live' : counts[i].here.length + counts[i].passed || !i ? 'cell seen' : 'cell'} href={stageHref(s, fid)}
              title={`${i + 1} / 6 ${t(`n.${s}`)}`} aria-current={i === si ? 'page' : undefined}>{i + 1}<span className="sr">{t(`n.${s}`)}</span></a>
          ))}
        </nav>
        {stage && <span className="docbar-at"><b>{si + 1} / 6</b>{name}</span>}
        {stage && feature && (
          <label className="pick"><span>{t('bar.feature')}</span>
            <select value={choosing ?? feature.id} onChange={e => { const to = project.features.find(x => x.id === e.target.value); if (to) location.hash = featureHref(stage, to, sub) }}>
              {project.features.map(x => <option key={x.id} value={x.id}>{x.id} · {t(`n.${x.stage}`)}{x.docs.some(d => d.kind === kind) ? '' : ` (${t('nodoc')})`}</option>)}
            </select>
          </label>
        )}
        {stage && (
          <span className="docbar-nav">
            {si > 0 ? <a href={stageHref(STAGES[si - 1], fid)}>← {t(`n.${STAGES[si - 1]}`)}</a> : <span>{t('bar.first')}</span>}
            {si < 5 ? <a href={stageHref(STAGES[si + 1], fid)}>{t(`n.${STAGES[si + 1]}`)} →</a> : <span>{t('bar.last')}</span>}
          </span>
        )}
        <i className="docbar-p" aria-hidden />
      </div>
      <article className={feature && busy(feature) && stageIndex(feature) === si ? 'paper live' : 'paper'}>
        <div className="tag">{stage && <b>{si + 1} / 6</b>}{stage ? name : !ref ? t('nf.tag') : feature ? t(`n.${feature.stage}`) : t('n.constitution')}<code>{ref ? ref.path : route.kind === 'doc' ? route.path : feature ? `${feature.id} / ${KIND_FILE[kind]}` : KIND_FILE[kind]}</code></div>
        <div className="pgrid">
          {/* The box is always there, in the same place and frame, so nothing jumps and the column never looks empty. */}
          {<nav className="toc" aria-label={t('toc')}>
            <b>{t('toc')}</b>
            {!toc.length && <p className="toc-none">{loading ? <span className="skel skel-line" /> : t('toc.none')}</p>}
            <ol>
              {toc.map((head, n) => (
                <li key={n}>
                  <button type="button" aria-current={n === at ? 'true' : undefined} onClick={() => sections()[n]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })}>
                    <span>{n + 1}</span>{head}
                  </button>
                </li>
              ))}
            </ol>
          </nav>}
          {/* One page, one set of sheets: a new page replaces them in one step instead of reshaping the old ones. */}
          <div className="psheet" ref={sheet} key={`${view.entry} ${view.path}`}>
            <header className="phead">
              {stage && <div className="phead-no">{si + 1}<span>/ 6</span></div>}
              <div className="phead-t">
                <h1 tabIndex={-1}>{name}</h1>
                {!stage && <p className="phead-say">{t('h.kind')} · {kind}</p>}
                <p className="phead-doc">{doc?.title ? <DocTitle doc={doc} /> : feature?.id}</p>
              </div>
              <div className="phead-cmd">
                {stage && <>
                  <span className="lbl">{t(cmd ? 'h.cmd' : 'h.nocmd')}</span>
                  <CmdRow cmd={cmd ?? CMD.specify} big />
                  {!cmd && <p>{t('h.restart')}</p>}
                </>}
                {feature
                  ? <>
                    <span className="phead-here">{t('h.feat', feature.id, t(`n.${feature.stage}`))}{feature.tasks ? ` · ${feature.tasks.done} / ${feature.tasks.total}` : ''}</span>
                    {next && next !== cmd && <span className="phead-next">{t('h.featnext')}<CmdRow cmd={next} /></span>}
                  </>
                  : bound !== null && <span className="phead-here">{t('h.all', bound)}</span>}
              </div>
              {doc && <DocMeta doc={doc} />}
              {feature && (
                <nav className="fdocs" aria-label={t('h.docs')}>
                  <span>{t('h.docs')}</span>
                  {feature.docs.map(d => <a key={d.path} href={docHref(feature, d)} aria-current={d.path === ref?.path ? 'page' : undefined}>{fileOf(d)}{d.error ? <span className="seen err">{t('err.read')}</span> : d.path !== ref?.path && <SeenMark docs={[d]} seen={seen} />}</a>)}
                </nav>
              )}
            </header>
            {failed && doc && <p role="status" className="notice">{t('refreshError')}</p>}
            {planTabs.length > 0 && feature && (
              <section className="sec tabsec">
                <p>{t('p.note')}</p>
                <nav className="tabs" aria-label={t('p.tabs')} onClickCapture={viaTabs('.tabs a[aria-current="page"]')}>
                  {planTabs.map(k => {
                    const docs = feature.docs.filter(d => d.kind === k), on = k === (sub ?? 'plan')
                    return (
                      <a key={k} href={stageHref('plan', feature.id, k === 'plan' ? null : k)} aria-current={on ? 'page' : undefined}>
                        <b>{KIND_FILE[k]}</b>
                        <span>{!docs.length ? t('nodoc') : k === 'plan' ? t('p.lead') : docs.length > 1 ? t('p.files', docs.length) : t('p.has')}{!on && <SeenMark docs={docs} seen={seen} />}</span>
                      </a>
                    )
                  })}
                </nav>
              </section>
            )}
            {refs.length > 1 && (
              <section className="sec tabsec">
                <div className="tabs" role="group" aria-label={t('choose')} onClickCapture={viaTabs('.tabs button[aria-pressed="true"]')}>
                  {refs.map(d => <button key={d.path} type="button" aria-pressed={d === ref} onClick={() => onPick(d.path)}><b>{fileOf(d)}</b><span>{KIND_FILE[d.kind]}{d !== ref && <SeenMark docs={[d]} seen={seen} />}</span></button>)}
                </div>
              </section>
            )}
            {body}
            <footer className="pfoot">
              {stage ? step(si - 1, 'prev') : <span />}
              <a className="step home" href="#/"><span>{t('zoomout')}</span><b>{t('allboard')}</b></a>
              {stage ? step(si + 1, 'next') : <span />}
            </footer>
          </div>
        </div>
      </article>
    </>
  )
}
