#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { startServer } from './server.ts'
import { isSpecKit, scanProject } from './scan.ts'

const fail = (msg: string): never => { process.stderr.write(msg + '\n'); process.exit(1) }

const { values, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: 'string' } } })
const root = path.resolve(positionals[0] ?? process.cwd())
const port = values.port === undefined ? 4321 : Number(values.port)
if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`Invalid port: ${values.port}`)

if (!isSpecKit(root)) fail(`Not a spec-kit project: no specs/ or .specify/ folder in ${root}`)
const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'web')
if (!fs.existsSync(path.join(webDir, 'index.html'))) fail('Web files are missing. Run: npm run build')

try {
  const srv = await startServer({ root, port, webDir })
  const p = scanProject(root)
  const docs = p.features.reduce((n, f) => n + f.docs.length, 0) + (p.constitution ? 1 : 0)
  console.log(`spec-kit project: ${p.features.length} features, ${docs} documents`)
  console.log(`Dashboard: http://127.0.0.1:${srv.port}`)
} catch (e) {
  if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') fail(`Port ${port} is in use. Try: spec-visualizer --port ${port + 1}`)
  throw e
}
