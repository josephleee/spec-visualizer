import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Project } from '../server/types.ts'
import Home from './Home.tsx'
import { useLang } from './i18n.ts'
import { useProject } from './live.ts'
import { loadSeen, markSeen, type Seen } from './seen.ts'
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

// Placeholder: Task 8 replaces this with the real document page.
function DocPlaceholder({ project, path, onSeen }: { project: Project; path: string; onSeen: (s: Seen) => void }) {
  const { t } = useLang()
  const ref = [project.constitution, ...project.features.flatMap(f => f.docs)].find(d => d?.path === path)
  useEffect(() => { if (ref) onSeen(markSeen(project.root, ref)) }, [path, ref?.hash])
  return (
    <section>
      <p><a href="#/">{t('home')}</a></p>
      <p>{path}</p>
    </section>
  )
}

function App() {
  const { project, connected } = useProject()
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
          : docPath ? <DocPlaceholder project={project} path={docPath} onSeen={setSeen} />
          : <Home project={project} seen={seen} />}
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
