import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { parseDoc } from './parsers.ts'
import { scanProject } from './scan.ts'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}
const JSON_TYPE = 'application/json; charset=utf-8'

export function startServer(opts: { root: string; port: number; webDir: string }): Promise<{ port: number; close(): Promise<void> }> {
  const { root } = opts
  const sse = new Set<http.ServerResponse>()
  const watchers: fs.FSWatcher[] = []
  let timer: NodeJS.Timeout | undefined
  let port = opts.port
  let webReal: string | undefined

  const notify = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { for (const r of sse) r.write('event: changed\ndata: {}\n\n') }, 100)
  }
  for (const d of ['specs', '.specify']) {
    try {
      if (!fs.statSync(path.join(root, d)).isDirectory()) continue
      const w = fs.watch(path.join(root, d), { recursive: true }, notify)
      w.on('error', () => w.close()) // folder deleted etc.: stop watching it, keep serving
      watchers.push(w)
    } catch { /* unwatchable folder: serve without live updates for it */ }
  }

  const send = (res: http.ServerResponse, status: number, type: string, body: string | Buffer) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(body)
  }
  const sendJson = (res: http.ServerResponse, status: number, data: unknown) => send(res, status, JSON_TYPE, JSON.stringify(data))
  const notFound = (res: http.ServerResponse) => sendJson(res, 404, { error: 'not found' })

  function serveStatic(res: http.ServerResponse, pathname: string) {
    try {
      webReal ??= fs.realpathSync(opts.webDir)
      const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname)
      if (rel.includes('\0')) return notFound(res)
      // realpath resolves symlinks, so a link pointing out of webDir fails the prefix check
      const file = fs.realpathSync(path.join(webReal, rel))
      if (!file.startsWith(webReal + path.sep) || !fs.statSync(file).isFile()) return notFound(res)
      send(res, 200, TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', fs.readFileSync(file))
    } catch {
      notFound(res)
    }
  }

  const server = http.createServer((req, res) => {
    try {
      const host = req.headers.host
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(res, 403, 'text/plain; charset=utf-8', 'forbidden')
      if (req.method !== 'GET') return send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname === '/api/project') return sendJson(res, 200, scanProject(root))
      if (url.pathname === '/api/doc') {
        const project = scanProject(root)
        const refs = [...project.features.flatMap((f) => f.docs), ...(project.constitution ? [project.constitution] : [])]
        const ref = refs.find((r) => r.path === url.searchParams.get('path'))
        if (!ref) return notFound(res)
        let src: string
        try { src = fs.readFileSync(path.join(root, ref.path), 'utf8') } catch { return notFound(res) }
        return sendJson(res, 200, parseDoc(ref, src))
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Connection: 'keep-alive' })
        res.write(': ok\n\n')
        sse.add(res)
        res.on('close', () => sse.delete(res))
        return
      }
      serveStatic(res, url.pathname)
    } catch {
      if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'internal error')
      else res.end()
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', (e) => { watchers.forEach((w) => w.close()); reject(e) })
    server.listen(opts.port, '127.0.0.1', () => {
      port = (server.address() as AddressInfo).port
      resolve({
        port,
        close: () => new Promise<void>((done) => {
          clearTimeout(timer)
          watchers.forEach((w) => w.close())
          for (const r of sse) r.end()
          server.close(() => done())
          server.closeAllConnections()
        }),
      })
    })
  })
}
