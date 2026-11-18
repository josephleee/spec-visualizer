import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { ParsedDoc } from '../server/types.ts'
import { Board } from './Board.tsx'
import { reducedMotion, slide, zoom } from './camera.ts'
import { setUnit, useLang } from './i18n.ts'
import { bootFlow, flowOf, type Flow } from './flows.ts'
import { useProject } from './live.ts'
import { fitRoute, parseRoute, resolveTarget, type Route } from './route.ts'
import { entryId } from './scroll.ts'
import { loadSeen, type Seen } from './seen.ts'
import { DocSkeleton, StagePage, type DocView } from './StagePage.tsx'
import { Strip } from './Strip.tsx'
import { useDoc } from './useDoc.ts'
import './styles.css'

type DocRoute = Exclude<Route, { kind: 'board' }>
const isDoc = (r: Route): r is DocRoute => r.kind !== 'board'
const stageNo = (r: Route, flow: Flow) => (r.kind === 'stage' ? flow.stages.findIndex(s => s.key === r.stage) : -1)

// What is on screen: an address together with everything it needs, so a page is only ever drawn whole.
type View = { route: Route; entry: string; path: string | null; doc: ParsedDoc | null | undefined; failed: boolean }
const isDocView = (v: View | null): v is DocView => !!v && isDoc(v.route)

// A page that throws while drawing shows this instead of a blank screen.
// It tries again when `retryOn` changes: another address, or new data (the file may have been fixed).
class Guard extends Component<{ retryOn: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidUpdate(prev: { retryOn: string }) { if (this.state.failed && prev.retryOn !== this.props.retryOn) this.setState({ failed: false }) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// The address asked for, and the id of its history entry (which the reading position is kept under).
function useRoute(flow: Flow): { hash: string; route: Route; entry: string } {
  const [at, setAt] = useState(() => ({ hash: location.hash, entry: entryId() }))
  useEffect(() => {
    const f = () => setAt({ hash: location.hash, entry: entryId() })
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return { ...at, route: useMemo(() => fitRoute(parseRoute(at.hash), flow), [at.hash, flow]) }
}

function App() {
  const { project: fetched, connected, version } = useProject()
  const { t } = useLang()
  // The project's format; before it arrives, the one the server put on the page (they are the same).
  const flow = fetched ? flowOf(fetched) : bootFlow()
  useLayoutEffect(() => setUnit(flow.unit), [flow])
  const { hash, route, entry } = useRoute(flow)
  const [seen, setSeen] = useState<Seen | null>(null)
  useEffect(() => { if (fetched && !seen) setSeen(loadSeen(fetched)) }, [fetched])
  const project = seen ? fetched : null

  // ---------- what was asked for: the address, and the document it needs ----------
  const [picked, setPicked] = useState<string | null>(null) // which one, when a feature has several documents of the kind
  const target = project && isDoc(route) ? resolveTarget(project, route) : null
  const ref = target ? target.refs.find(d => d.path === picked) ?? target.refs[0] ?? null : null
  const path = ref && !ref.error ? ref.path : null
  const { doc, failed } = useDoc(path, version)
  const ready = !!project && (!path || doc !== undefined)

  // ---------- what is on screen: it changes only when everything asked for has arrived, and then once ----------
  const [view, setView] = useState<View | null>(null)
  if (ready && (!view || view.route !== route || view.path !== path || view.doc !== doc || view.failed !== failed)) setView({ route, entry, path, doc, failed })
  const pending = !!view && !ready

  // The camera. 'in': the board stays up while the document grows out of its card.
  // A view held here: that document stays up while the camera pulls back to the board.
  const [last, setLast] = useState<View | null>(null)
  const [move, setMove] = useState<'in' | DocView | null>(null)
  if (last !== view) {
    setLast(view)
    if (last?.route !== view?.route) setMove(!last || !view || reducedMotion() ? null : isDocView(last) && !isDocView(view) ? last : !isDocView(last) && isDocView(view) ? 'in' : null)
  }
  const docView = isDocView(view) ? view : move && move !== 'in' ? move : null
  const at = view?.route ?? null
  const cam = useRef<HTMLElement>(null), board = useRef<HTMLElement>(null), docEl = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!move) return
    if (!cam.current || !board.current || !docEl.current || !docView) { setMove(null); return }
    const frame = board.current.querySelector(`[data-i="${stageNo(docView.route, flow)}"] .frame`)
    return zoom(cam.current, board.current, docEl.current, frame, move !== 'in', () => flushSync(() => setMove(null)))
  }, [move])

  const prev = useRef<Route | null>(null)
  useLayoutEffect(() => {
    const from = prev.current
    prev.current = at
    if (!from || !at || from === at) return // the first page takes no focus
    if (!isDoc(at)) { // back on the board: focus returns to the card that was open, or to the board heading when no card was
      if (isDoc(from)) board.current?.querySelector<HTMLElement>(from.kind === 'stage' ? `[data-i="${stageNo(from, flow)}"] .stage-link` : 'h1')?.focus({ preventScroll: true })
      return
    }
    const sameStage = from.kind === 'stage' && at.kind === 'stage' && from.stage === at.stage
    if (from.kind === 'stage' && at.kind === 'stage' && !sameStage && !reducedMotion() && docEl.current) slide(docEl.current, Math.sign(stageNo(at, flow) - stageNo(from, flow)))
    // Within one stage (another feature from the select, another plan document from its tab) focus stays on the control used.
    if (!sameStage) docEl.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [at])

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape' && isDoc(route) && !(e.target instanceof HTMLSelectElement)) location.hash = '#/' }
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [route])

  const name = project?.name ?? 'spec-visualizer'
  useEffect(() => {
    // The title names what is shown: the feature the page resolved to, never an id that is only in the address.
    const feature = project && at && isDoc(at) ? resolveTarget(project, at).feature?.id : null
    document.title = at?.kind === 'stage' ? `${stageNo(at, flow) + 1} / ${flow.stages.length} ${t(`n.${at.stage}`)}${feature ? ` · ${feature}` : ''} · ${name}`
      : at?.kind === 'doc' ? `${at.path} · ${name}` : t('title', name)
  })

  const retryOn = `${hash} ${version}`
  const broken = <div className="paper"><section className="sec empty" role="alert"><h2>{t('err.title')}</h2><p>{t('err.say')}</p><a className="empty-go" href="#/">{t('back')} →</a></section></div>
  // Before the first page is whole there is one skeleton, in the shape of the page that was asked for.
  const cold = !view
  return (
    <>
      <Strip project={cold ? null : project} />
      <main className="cam" ref={cam} aria-busy={cold || pending}>
        {pending && <div className="loadbar" role="status"><span className="sr">{t('loading')}</span></div>}
        <section ref={board} className="layer board" aria-label={t('board', name)} hidden={cold ? isDoc(route) : isDocView(view) && move !== 'in'}>
          <Guard retryOn={retryOn} fallback={broken}><Board project={cold ? null : project} seen={seen ?? {}} /></Guard>
        </section>
        {cold && isDoc(route) && <section className="layer doc" aria-label={t('doc.layer')}><DocSkeleton /></section>}
        {!cold && docView && project && seen && (
          <section ref={docEl} className="layer doc" aria-label={t('doc.layer')}>
            <Guard retryOn={retryOn} fallback={broken}>
              <StagePage view={docView} asked={route} project={project} seen={seen} onSeen={setSeen} onPick={setPicked} />
            </Guard>
          </section>
        )}
      </main>
      {!connected && <div role="alert" className="banner">{t('disconnected')}</div>}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
