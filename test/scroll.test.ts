import { expect, test } from 'vitest'
import { entryId, saveScroll, savedScroll } from '../web/scroll.ts'

const fakeStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage
}
const fakeHistory = (state: unknown = null) => ({ state, replaceState(s: unknown) { this.state = s } })

test('a history entry gets an id once and keeps it', () => {
  const h = fakeHistory()
  const id = entryId(h)
  expect(id).toMatch(/^[a-z0-9]+$/)
  expect(entryId(h)).toBe(id)
  expect(entryId(fakeHistory())).not.toBe(id)
})

test('giving an entry its id keeps whatever state it already had', () => {
  const h = fakeHistory({ other: 1 })
  const id = entryId(h)
  expect(h.state).toEqual({ other: 1, k: id })
})

test('a position is read back for its own entry only; a new entry has none', () => {
  const store = fakeStore()
  saveScroll('a', 1499.6, store)
  expect(savedScroll('a', store)).toBe(1500)
  expect(savedScroll('b', store)).toBeNull()
})

test('unreadable or broken storage means no saved position, never an error', () => {
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as unknown as Storage
  expect(savedScroll('a', broken)).toBeNull()
  expect(() => saveScroll('a', 3, broken)).not.toThrow()
  const store = fakeStore()
  for (const bad of ['x', '-5', 'NaN', '']) { store.setItem('specviz:scroll:a', bad); expect(savedScroll('a', store), bad).toBeNull() }
  expect(() => entryId({ state: null, replaceState() { throw new Error('x') } })).not.toThrow()
})
