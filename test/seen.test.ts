import { expect, test } from 'vitest'
import { loadSeen, markOf, markSeen } from '../web/seen.ts'

const doc = (path: string, hash: string) => ({ path, kind: 'other' as const, hash })
const fakeStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage
}
const project = { root: '/p', constitution: doc('c.md', 'h0'), features: [{ docs: [doc('a.md', 'h1'), doc('b.md', 'h2')] }] } as any

test('first open records every document as seen', () => {
  const store = fakeStore()
  const seen = loadSeen(project, store)
  expect(seen).toEqual({ 'c.md': 'h0', 'a.md': 'h1', 'b.md': 'h2' })
  expect(JSON.parse(store.getItem('specviz:seen:/p')!)).toEqual(seen)
  expect(markOf(doc('a.md', 'h1'), seen)).toBeNull()
})

test('later documents are new, different hashes are changed, opening clears the mark', () => {
  const store = fakeStore(); loadSeen(project, store)
  let seen = loadSeen(project, store)
  expect(markOf(doc('new.md', 'h9'), seen)).toBe('new')
  expect(markOf(doc('a.md', 'CHANGED'), seen)).toBe('changed')
  seen = markSeen('/p', doc('a.md', 'CHANGED'), store)
  expect(markOf(doc('a.md', 'CHANGED'), seen)).toBeNull()
})

test('a document with an error has no mark', () => {
  expect(markOf({ ...doc('x.md', ''), error: 'boom' }, {})).toBeNull()
})

test('a storage that throws does not break the page', () => {
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as any
  expect(loadSeen(project, broken)).toEqual({ 'c.md': 'h0', 'a.md': 'h1', 'b.md': 'h2' })
  expect(() => markSeen('/p', doc('a.md', 'h1'), broken)).not.toThrow()
})

test('a stored value that is not a plain object counts as absent', () => {
  for (const bad of ['5', '"x"', '[]', 'null', '{oops']) {
    const store = fakeStore(); store.setItem('specviz:seen:/p', bad)
    const seen = loadSeen(project, store)
    expect(seen).toEqual({ 'c.md': 'h0', 'a.md': 'h1', 'b.md': 'h2' })
    expect(() => markOf(doc('a.md', 'h1'), seen)).not.toThrow()
  }
})

test('with unreadable storage, opening one document keeps the marks of the others', () => {
  const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as any
  const before = { 'a.md': 'h1', 'b.md': 'h2' }
  const seen = markSeen('/p', doc('a.md', 'H1B'), broken, before)
  expect(seen).toEqual({ 'a.md': 'H1B', 'b.md': 'h2' })
})
