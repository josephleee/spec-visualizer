// Keeps results that depend only on a file's content, so an unchanged file is not parsed again.
// Bounded by total weight; the entries not used for longest leave first. Callers must not alter what they get back.
export function memo<T>(max: number, weigh: (value: T) => number = () => 1) {
  const kept = new Map<string, { value: T; weight: number }>() // in order of last use
  let total = 0
  return (key: string, make: () => T): T => {
    const hit = kept.get(key)
    if (hit) { kept.delete(key); kept.set(key, hit); return hit.value }
    const value = make()
    const weight = weigh(value)
    if (weight > max) return value
    kept.set(key, { value, weight })
    total += weight
    for (const [k, e] of kept) {
      if (total <= max) break
      kept.delete(k)
      total -= e.weight
    }
    return value
  }
}
