import type { DocRef, Project } from '../server/types.ts'

export type Seen = Record<string, string> // doc path -> hash when last opened

const key = (root: string) => `specviz:seen:${root}`
const defaultStore = () => { try { return globalThis.localStorage } catch { return undefined } }

function read(root: string, store?: Storage): Seen | null {
  try {
    const raw = (store ?? defaultStore())?.getItem(key(root))
    const v: unknown = raw ? JSON.parse(raw) : null
    // Anything but a plain object (e.g. a stored `5`) would make markOf throw during render.
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Seen : null
  } catch { return null }
}
function write(root: string, seen: Seen, store?: Storage) {
  try { (store ?? defaultStore())?.setItem(key(root), JSON.stringify(seen)) } catch { /* storage unavailable: marks just reset */ }
}

export function loadSeen(project: Project, store?: Storage): Seen {
  const saved = read(project.root, store)
  if (saved) return saved
  const seen: Seen = {}
  for (const d of [project.constitution, ...project.features.flatMap(f => f.docs)]) if (d && !d.error) seen[d.path] = d.hash
  write(project.root, seen, store)
  return seen
}

export function markOf(doc: DocRef, seen: Seen): 'new' | 'changed' | null {
  if (doc.error) return null
  if (!(doc.path in seen)) return 'new'
  return seen[doc.path] !== doc.hash ? 'changed' : null
}

export function markSeen(root: string, doc: DocRef, store?: Storage, base?: Seen): Seen {
  const seen = { ...(read(root, store) ?? base ?? {}), [doc.path]: doc.hash }
  write(root, seen, store)
  return seen
}
