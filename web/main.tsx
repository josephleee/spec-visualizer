import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Board } from './Board.tsx'
import { reducedMotion, slide, zoom } from './camera.ts'
import { useLang } from './i18n.ts'
import { useProject } from './live.ts'
import { STAGES, parseRoute, type Route } from './route.ts'
import { loadSeen, type Seen } from './seen.ts'
import { DocSkeleton, StagePage } from './StagePage.tsx'
import { Strip } from './Strip.tsx'
import './styles.css'

type DocRoute = Exclude<Route, { kind: 'board' }>
const isDoc = (r: Route): r is DocRoute => r.kind !== 'board'
const stageNo = (r: Route) => (r.kind === 'stage' ? STAGES.indexOf(r.stage) : -1)

// A page that throws while drawing shows this instead of a blank screen.
// It tries again when `retryOn` changes: another address, or new data (the file may have been fixed).
class Guard extends Component<{ retryOn: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidUpdate(prev: { retryOn: string }) { if (this.state.failed && prev.retryOn !== this.props.retryOn) this.setState({ failed: false }) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function useRoute(): { hash: string; route: Route } {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const f = () => setHash(location.hash)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return { hash, route: useMemo(() => parseRoute(hash), [hash]) }
}

function App() {
  const { project, connected, version } = useProject()
  const { t } = useLang()
  const { hash, route } = useRoute()
  const [seen, setSeen] = useState<Seen | null>(null)
  useEffect(() => { if (project && !seen) setSeen(loadSeen(project)) }, [project])

  // The camera. 'in': the board stays up while the document grows out of its card.
  // A document route held here: that document stays up while the camera pulls back to the board.
  const [last, setLast] = useState(route)
  const [move, setMove] = useState<'in' | DocRoute | null>(null)
  if (last !== route) {
    setLast(route)
    setMove(reducedMotion() ? null : isDoc(last) && !isDoc(route) ? last : !isDoc(last) && isDoc(route) ? 'in' : null)
  }
  const shown = isDoc(route) ? route : move && move !== 'in' ? move : null
  const cam = useRef<HTMLElement>(null), board = useRef<HTMLElement>(null), doc = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!move) return
    if (!cam.current || !board.current || !doc.current || !shown) { setMove(null); return }
    const frame = board.current.querySelector(`[data-i="${stageNo(shown)}"] .frame`)
    return zoom(cam.current, board.current, doc.current, frame, move !== 'in', () => flushSync(() => setMove(null)))
  }, [move])

  const prev = useRef(route)
  useLayoutEffect(() => {
    const from = prev.current
    prev.current = route
    if (from === route) return
    if (!isDoc(route)) { // back on the board: focus returns to the card that was open, or to the board heading when no card was
      if (isDoc(from)) board.current?.querySelector<HTMLElement>(from.kind === 'stage' ? `[data-i="${stageNo(from)}"] .stage-link` : 'h1')?.focus({ preventScroll: true })
      return
    }
    const sameStage = from.kind === 'stage' && route.kind === 'stage' && from.stage === route.stage
    if (from.kind === 'stage' && route.kind === 'stage' && !sameStage && !reducedMotion() && doc.current) slide(doc.current, Math.sign(stageNo(route) - stageNo(from)))
    // Within one stage (another feature from the select, another plan document from its tab) focus stays on the control used.
    if (!sameStage) doc.current?.querySelector('h1')?.focus({ preventScroll: true })
  }, [route])

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape' && isDoc(route) && !(e.target instanceof HTMLSelectElement)) location.hash = '#/' }
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [route])

  const name = project?.name ?? 'spec-visualizer'
  useEffect(() => {
    document.title = route.kind === 'stage' ? `${stageNo(route) + 1} / 6 ${t(`n.${route.stage}`)}${route.feature && route.stage !== 'constitution' ? ` · ${route.feature}` : ''} · ${name}`
      : route.kind === 'doc' ? `${route.path} · ${name}` : t('title', name)
  })

  const retryOn = `${hash} ${version}`
  const failed = <div className="paper"><section className="sec empty" role="alert"><h2>{t('err.title')}</h2><p>{t('err.say')}</p><a className="empty-go" href="#/">{t('back')} →</a></section></div>
  return (
    <>
      {!connected && <div role="alert" className="banner">{t('disconnected')}</div>}
      <Strip project={project} />
      <main className="cam" ref={cam}>
        <section ref={board} className="layer board" aria-label={t('board', name)} hidden={isDoc(route) && move !== 'in'}>
          <Guard retryOn={retryOn} fallback={failed}><Board project={seen ? project : null} seen={seen ?? {}} /></Guard>
        </section>
        {shown && (
          <section ref={doc} className="layer doc" aria-label={t('doc.layer')}>
            <Guard retryOn={retryOn} fallback={failed}>{project && seen ? <StagePage route={shown} project={project} version={version} seen={seen} onSeen={setSeen} /> : <DocSkeleton />}</Guard>
          </section>
        )}
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
