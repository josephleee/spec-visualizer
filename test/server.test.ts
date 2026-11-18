import { afterAll, beforeAll, expect, test } from 'vitest'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../server/server.ts'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'specviz-srv-'))
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const root = tmp()
const webDir = tmp()
let port = 0
let base = ''
let close: () => Promise<void>

const rawGet = (p: number, url: string, headers: Record<string, string>) =>
  new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: p, path: url, headers }, (res) => { res.resume(); resolve(res) }).on('error', reject)
  })

// Counts `changed` events on the SSE stream.
function collectSse(url: string) {
  const ac = new AbortController()
  const out = { count: 0, ready: Promise.resolve(), close: () => ac.abort() }
  out.ready = fetch(url, { signal: ac.signal }).then(async (res) => {
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    ;(async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) return
          out.count += dec.decode(value).split('event: changed').length - 1
        }
      } catch { /* aborted */ }
    })()
  })
  return out
}

beforeAll(async () => {
  fs.mkdirSync(path.join(root, 'specs/001-x'), { recursive: true })
  fs.writeFileSync(path.join(root, 'specs/001-x/spec.md'), '# Spec\n')
  fs.writeFileSync(path.join(root, 'package.json'), '{}')
  fs.writeFileSync(path.join(webDir, 'index.html'), '<h1>hi</h1>')
  fs.writeFileSync(path.join(webDir, 'app.js'), 'x')
  ;({ port, close } = await startServer({ root, port: 0, webDir }))
  base = `http://127.0.0.1:${port}`
  await wait(300) // late fs events for files created just before the watcher started
})
afterAll(async () => {
  await close()
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(webDir, { recursive: true, force: true })
})

test('project and doc routes', async () => {
  const p = await (await fetch(`${base}/api/project`)).json()
  expect(p.features[0].id).toBe('001-x')
  const d = await (await fetch(`${base}/api/doc?path=specs/001-x/spec.md`)).json()
  expect(d.ref.kind).toBe('spec')
})

test('unknown and escaping paths get 404', async () => {
  for (const p of ['../../etc/passwd', 'package.json', 'specs/001-x/../../secret.md', '/etc/passwd'])
    expect((await fetch(`${base}/api/doc?path=${encodeURIComponent(p)}`)).status).toBe(404)
  expect((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status).not.toBe(200)
})

test('static files: index, existing file, everything else 404', async () => {
  const idx = await fetch(`${base}/`)
  expect(idx.status).toBe(200)
  expect(idx.headers.get('content-type')).toContain('text/html')
  expect(idx.headers.get('x-content-type-options')).toBe('nosniff')
  expect(idx.headers.get('cache-control')).toBe('no-store')
  expect((await fetch(`${base}/app.js`)).headers.get('content-type')).toContain('javascript')
  expect((await fetch(`${base}/nope`)).status).toBe(404)
})

test('a foreign Host header gets 403 and POST gets 405', async () => {
  expect((await rawGet(port, '/api/project', { Host: 'evil.example' })).statusCode).toBe(403)
  expect((await fetch(`${base}/api/project`, { method: 'POST' })).status).toBe(405)
})

test('a file change sends one changed event', async () => {
  const events = collectSse(`${base}/api/events`)
  await events.ready
  fs.appendFileSync(path.join(root, 'specs/001-x/spec.md'), '\nmore\n')
  fs.appendFileSync(path.join(root, 'specs/001-x/spec.md'), '\nmore\n')
  await wait(400)
  expect(events.count).toBe(1)
  events.close()
})

test('the listen error for a used port rejects', async () => {
  await expect(startServer({ root, port, webDir })).rejects.toMatchObject({ code: 'EADDRINUSE' })
})

test('folders created after start are watched', async () => {
  const late = tmp()
  fs.mkdirSync(path.join(late, '.specify'))
  const s = await startServer({ root: late, port: 0, webDir })
  const events = collectSse(`http://127.0.0.1:${s.port}/api/events`)
  await events.ready
  await wait(300)
  fs.mkdirSync(path.join(late, 'specs/001-a'), { recursive: true })
  await wait(400)
  fs.writeFileSync(path.join(late, 'specs/001-a/spec.md'), '# A\n')
  await wait(400)
  expect(events.count).toBeGreaterThanOrEqual(2)
  events.close()
  await s.close()
  fs.rmSync(late, { recursive: true, force: true })
})
test('a deleted scanned document gets 404', async () => {
  const f = path.join(root, 'specs/001-x/gone.md')
  fs.writeFileSync(f, '# Gone\n')
  expect((await fetch(`${base}/api/doc?path=specs/001-x/gone.md`)).status).toBe(200)
  fs.rmSync(f)
  expect((await fetch(`${base}/api/doc?path=specs/001-x/gone.md`)).status).toBe(404)
})

test('security: traversal, NUL and symlinks out of webDir are 404', async () => {
  fs.writeFileSync(path.join(root, 'secret.txt'), 'secret')
  const link = path.join(webDir, 'link.txt')
  if (!fs.existsSync(link)) fs.symlinkSync(path.join(root, 'secret.txt'), link)
  const h = { Host: `127.0.0.1:${port}` }
  expect((await rawGet(port, '/..%2f..%2fetc%2fpasswd', h)).statusCode).toBe(404)
  expect((await rawGet(port, '/link.txt', h)).statusCode).toBe(404)
  expect((await rawGet(port, '/app.js%00', h)).statusCode).toBe(404)
})

test('security: Host must match this server', async () => {
  expect((await rawGet(port, '/', { Host: `127.0.0.1:${port + 1}` })).statusCode).toBe(403)
  for (const url of ['/', '/api/events']) expect((await rawGet(port, url, { Host: 'evil.example' })).statusCode).toBe(403)
  const noHost = await new Promise<number>((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', setHost: false, headers: {} }, (res) => { res.resume(); resolve(res.statusCode!) })
    req.on('error', () => resolve(0))
    req.end()
  })
  expect(noHost).not.toBe(200)
})

test('a root README change sends a changed event, other root files do not', async () => {
  await wait(300) // late fs events from the tests above
  const events = collectSse(`${base}/api/events`)
  await events.ready
  fs.writeFileSync(path.join(root, 'notes.txt'), 'x')
  await wait(400)
  expect(events.count).toBe(0)
  for (const [i, name] of ['README.md', 'readme.md', 'Readme.md'].entries()) {
    fs.rmSync(path.join(root, name), { force: true }) // same file on a case-insensitive disk
    fs.writeFileSync(path.join(root, name), '# R\n\nAbout.\n')
    await wait(400)
    expect(events.count).toBeGreaterThan(i)
    events.count = i + 1
  }
  events.close()
})
