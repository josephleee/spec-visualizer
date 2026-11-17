import { expect, test } from 'vitest'
import { latestOnly, settle } from '../web/live.ts'

const deferred = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}

test('a slow older response never overwrites a newer one', async () => {
  const applied: string[] = []
  const run = latestOnly<string>(v => applied.push(v))
  const a = deferred<string>(), b = deferred<string>()
  run(a.promise); run(b.promise)
  b.resolve('new'); await b.promise
  a.resolve('old'); await a.promise
  await Promise.resolve()
  expect(applied).toEqual(['new'])
})

test('a rejected promise applies nothing and does not throw', async () => {
  const applied: string[] = []
  const run = latestOnly<string>(v => applied.push(v))
  const a = deferred<string>()
  run(a.promise)
  a.reject(new Error('x'))
  await new Promise(r => setTimeout(r, 0))
  expect(applied).toEqual([])
})

test('a failed fetch keeps the content already shown for that path, flagged', () => {
  const shown = { path: 'a.md', doc: 'A' }
  expect(settle(null, { path: 'a.md', doc: null, failed: true })).toEqual({ path: 'a.md', doc: null, failed: true })
  expect(settle(shown, { path: 'a.md', doc: null, failed: true })).toEqual({ path: 'a.md', doc: 'A', failed: true })
  expect(settle(shown, { path: 'b.md', doc: null, failed: true })).toEqual({ path: 'b.md', doc: null, failed: true })
  expect(settle({ ...shown, failed: true }, { path: 'a.md', doc: 'A2' })).toEqual({ path: 'a.md', doc: 'A2' })
})
