import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DocPage } from './DocPage.tsx'
import Home from './Home.tsx'
import { useLang } from './i18n.ts'
import { useProject } from './live.ts'
import { loadSeen, type Seen } from './seen.ts'
import './styles.css'

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const f = () => setHash(location.hash)
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return hash
}

function App() {
  const { project, connected, version } = useProject()
  const { lang, setLang, t } = useLang()
  const hash = useHash()
  const [seen, setSeen] = useState<Seen | null>(null)
  useEffect(() => { if (project && !seen) setSeen(loadSeen(project)) }, [project])

  const m = hash.match(/^#\/doc\/(.+)$/)
  let docPath: string | null = null
  if (m) { try { docPath = decodeURIComponent(m[1]) } catch { /* bad escape: show home */ } }

  return (
    <>
      {!connected && <div role="alert" className="banner">{t('disconnected')}</div>}
      <header className="top">
        <a href="#/" className="brand">spec-visualizer</a>
        <button type="button" aria-label={t('language')} onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
          {lang === 'en' ? '한국어' : 'English'}
        </button>
      </header>
      <main>
        {!project || !seen ? <p>{t('loading')}</p>
          : docPath ? <DocPage path={docPath} project={project} version={version} seen={seen} onSeen={setSeen} />
          : <Home project={project} seen={seen} />}
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
