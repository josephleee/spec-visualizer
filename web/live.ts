import { useEffect, useState } from 'react'
import type { Project } from '../server/types.ts'

export function useProject() {
  const [project, setProject] = useState<Project | null>(null)
  const [connected, setConnected] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/project').then(r => r.json()).then(p => alive && setProject(p), () => {})
    load()
    const es = new EventSource('/api/events')
    es.addEventListener('changed', () => { setVersion(v => v + 1); load() })
    es.addEventListener('open', () => { setConnected(true); load() })
    es.addEventListener('error', () => setConnected(false))
    return () => { alive = false; es.close() }
  }, [])

  return { project, connected, version }
}
