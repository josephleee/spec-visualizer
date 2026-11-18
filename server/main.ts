import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { startServer } from './server.ts'
import { isSpecKit, scanProject } from './scan.ts'

// This file is server/main.ts in a checkout and dist/server/main.js in the package.
const here = fileURLToPath(import.meta.url)
const pkgRoot = path.join(path.dirname(here), here.endsWith('.ts') ? '..' : '../..')
const DEFAULT_PORT = 4321
const TRIES = 10

const HELP = `Usage: spec-visualizer [path] [options]

A local, read-only dashboard for a spec-kit project.
Without a path it shows the current folder, which must contain specs/ or .specify/.

Options:
  --port <n>   Port to listen on (default ${DEFAULT_PORT}, or the next free one)
  --demo       Show the bundled example project instead of a path
  --no-open    Do not open the browser
  --help       Show this help
  --version    Show the version`

// A message for the user: the CLI prints it and exits 1.
export class CliError extends Error {}

type Server = Awaited<ReturnType<typeof startServer>>

// The command that opens a URL in the default browser. The URL is one argument of execFile, so no shell reads it.
export function opener(platform: string, url: string): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]]
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]]
  return ['xdg-open', [url]]
}

export function openBrowser(url: string) {
  const [cmd, args] = opener(process.platform, url)
  execFile(cmd, args, () => { /* no opener on this machine: the address is printed anyway */ })
}

const busy = (e: unknown) => (e as NodeJS.ErrnoException).code === 'EADDRINUSE'

// Starts on opts.port, or on the first free port of the `tries` that follow.
export async function startOnFreePort(opts: Parameters<typeof startServer>[0], tries = TRIES): Promise<Server> {
  for (let i = 0; ; i++) {
    try {
      return await startServer({ ...opts, port: opts.port + i })
    } catch (e) {
      if (!busy(e) || i + 1 >= tries) throw e
    }
  }
}

export async function run(
  argv: string[],
  io: { out(line: string): void; open?(url: string): void; webDir?: string },
): Promise<Server | undefined> {
  let args
  try {
    args = parseArgs({
      args: argv, allowPositionals: true,
      options: { port: { type: 'string' }, demo: { type: 'boolean' }, 'no-open': { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' } },
    })
  } catch (e) {
    throw new CliError(`${(e as Error).message}\nSee: spec-visualizer --help`)
  }
  const { values, positionals } = args
  if (values.help) return void io.out(HELP)
  if (values.version) return void io.out(JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version)

  if (values.demo && positionals.length) throw new CliError('--demo takes no path')
  const root = values.demo ? path.join(pkgRoot, 'examples', 'demo') : path.resolve(positionals[0] ?? process.cwd())
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError(`Invalid port: ${values.port}`)

  if (!isSpecKit(root)) throw new CliError(`Not a spec-kit project: no specs/ or .specify/ folder in ${root}`)
  const webDir = io.webDir ?? path.join(pkgRoot, 'dist', 'web')
  if (!fs.existsSync(path.join(webDir, 'index.html'))) throw new CliError('Web files are missing. Run: npm run build')

  let srv: Server
  try {
    // Only the default port moves on when taken: a port the user asked for is that port or nothing.
    srv = values.port === undefined ? await startOnFreePort({ root, port, webDir }) : await startServer({ root, port, webDir })
  } catch (e) {
    if (!busy(e)) throw e
    throw new CliError(values.port === undefined
      ? `Ports ${port} to ${port + TRIES - 1} are in use. Try: spec-visualizer --port ${port + TRIES}`
      : `Port ${port} is in use. Try: spec-visualizer --port ${port + 1}`)
  }
  const p = scanProject(root)
  const docs = p.features.reduce((n, f) => n + f.docs.length, 0) + (p.constitution ? 1 : 0)
  const url = `http://127.0.0.1:${srv.port}`
  io.out(`spec-kit project: ${p.features.length} features, ${docs} documents`)
  io.out(`Dashboard: ${url}`)
  if (!values['no-open']) io.open?.(url)
  return srv
}
