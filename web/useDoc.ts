import { useEffect, useRef, useState } from 'react'
import type { ParsedDoc } from '../server/types.ts'
import { latestOnly, settle, type Loaded } from './live.ts'

// One open document. doc: undefined = loading, null = gone. A failed refresh keeps the content already shown.
export function useDoc(path: string | null, version: number): { doc: ParsedDoc | null | undefined; failed: boolean } {
  const [result, setResult] = useState<Loaded<ParsedDoc> | null>(null)
  // One shared guard so a slow older response never overwrites a newer one.
  const apply = useRef<ReturnType<typeof latestOnly<Loaded<ParsedDoc>>>>(null)
  apply.current ??= latestOnly<Loaded<ParsedDoc>>(next => setResult(prev => settle(prev, next)))

  useEffect(() => {
    if (!path) return
    apply.current!(fetch(`/api/doc?path=${encodeURIComponent(path)}`).then(async r => {
      if (r.status === 404) return { path, doc: null }
      if (!r.ok) throw new Error(String(r.status))
      return { path, doc: await r.json() as ParsedDoc }
    }).catch(() => ({ path, doc: null, failed: true })))
  }, [path, version])

  const mine = path && result?.path === path ? result : null
  return { doc: mine ? mine.doc : undefined, failed: !!mine?.failed }
}
