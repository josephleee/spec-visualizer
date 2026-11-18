// Reading position per history entry, so back, forward and reload return to where the reader was.
// Each entry gets an id in history.state; the positions live in session storage under that id.
type Hist = Pick<History, 'state' | 'replaceState'>
const key = (id: string) => `specviz:scroll:${id}`
const defaultStore = () => { try { return globalThis.sessionStorage } catch { return undefined } }

// The id of the current history entry, given to it the first time it is asked for.
export function entryId(history: Hist = globalThis.history): string {
  const had: unknown = (history.state as { k?: unknown } | null)?.k
  if (typeof had === 'string') return had
  const k = Math.random().toString(36).slice(2, 10)
  try { history.replaceState({ ...(history.state as object | null), k }, '') } catch { /* no history access: positions just do not persist */ }
  return k
}

// null = nothing saved: a new entry, which starts at the top.
export function savedScroll(id: string, store: Storage | undefined = defaultStore()): number | null {
  try {
    const raw = store?.getItem(key(id))
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch { return null }
}

export function saveScroll(id: string, y: number, store: Storage | undefined = defaultStore()) {
  try { store?.setItem(key(id), String(Math.round(y))) } catch { /* storage unavailable */ }
}
