import { useEffect, useState } from 'react'
import type { Project } from '../server/types.ts'

// Applies only the result of the most recently started request; failures change nothing.
export function latestOnly<T>(apply: (v: T) => void) {
  let latest = 0
  return (p: Promise<T>) => {
    const mine = ++latest
    p.then(v => { if (mine === latest) apply(v) }, () => {})
  }
}

export type Loaded<T> = { path: string; doc: T | null; failed?: boolean } // doc null = gone (or nothing to show)

// A failed refetch keeps what is shown for the same path and flags it; a failed first load has nothing to keep.
export const settle = <T>(prev: Loaded<T> | null, next: Loaded<T>): Loaded<T> =>
  next.failed && prev?.path === next.path && prev.doc ? { ...prev, failed: true } : next

export function useProject() {
  const [project, setProject] = useState<Project | null>(null)
  const [connected, setConnected] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    const apply = latestOnly<Project>(p => alive && setProject(p))
    const load = () => apply(fetch('/api/project').then(r => r.json()))
    load()
    const es = new EventSource('/api/events')
    es.addEventListener('changed', () => { setVersion(v => v + 1); load() })
    es.addEventListener('open', () => { setConnected(true); setVersion(v => v + 1); load() })
    es.addEventListener('error', () => setConnected(false))
    return () => { alive = false; es.close() }
  }, [])

  return { project, connected, version }
}
