import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { startServer } from './server.ts'
import { ADAPTERS, adapter, detect, type Adapter } from './formats.ts'
import type { FormatId } from './types.ts'
import { lst } from './scan.ts'

// This file is server/main.ts in a checkout and dist/server/main.js in the package.
const here = fileURLToPath(import.meta.url)
const pkgRoot = path.join(path.dirname(here), here.endsWith('.ts') ? '..' : '../..')
const DEFAULT_PORT = 4321
const TRIES = 10

const HELP = `Usage: spec-visualizer [path] [options]

A local, read-only dashboard for a spec-driven project: spec-kit, OpenSpec or Kiro.
Without a path it shows the current folder. The format is found from its folders:
specs/ or .specify/ (spec-kit), openspec/ (OpenSpec), .kiro/specs/ or .kiro/steering/ (Kiro).

Options:
  --port <n>       Port to listen on (default ${DEFAULT_PORT}, or the next free one)
  --format <name>  Read the folder as spec-kit, openspec or kiro instead of finding the format
  --demo           Show the bundled example project instead of a path
                   (with --format openspec or kiro: the example in that format)
  --no-open        Do not open the browser
  --help           Show this help
  --version        Show the version`

const an = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a')

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
      options: { port: { type: 'string' }, format: { type: 'string' }, demo: { type: 'boolean' }, 'no-open': { type: 'boolean' }, help: { type: 'boolean' }, version: { type: 'boolean' } },
    })
  } catch (e) {
    throw new CliError(`${(e as Error).message}\nSee: spec-visualizer --help`)
  }
  const { values, positionals } = args
  if (values.help) return void io.out(HELP)
  if (values.version) return void io.out(JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version)

  if (values.demo && positionals.length) throw new CliError('--demo takes no path')
  const asked = values.format
  if (asked !== undefined && !ADAPTERS.some((a) => a.id === asked)) throw new CliError(`Unknown format: ${asked}. Use one of: ${ADAPTERS.map((a) => a.id).join(', ')}`)
  const demo = asked && asked !== 'spec-kit' ? `demo-${asked}` : 'demo'
  const root = values.demo ? path.join(pkgRoot, 'examples', demo) : path.resolve(positionals[0] ?? process.cwd())
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new CliError(`Invalid port: ${values.port}`)

  const found = detect(root)
  // A format folder that exists as a symbolic link is not missing: say why it is not read.
  const links = ['specs', '.specify', 'openspec', '.kiro', '.kiro/specs', '.kiro/steering'].filter((d) => lst(path.join(root, d))?.isSymbolicLink())
  const linked = links.length ? `\n${links.join(', ')} ${links.length > 1 ? 'are symbolic links' : 'is a symbolic link'}, which spec-visualizer does not follow.` : ''
  let format: Adapter
  if (asked !== undefined) {
    format = adapter(asked as FormatId)
    if (!format.matches(root)) throw new CliError(`Not ${an(format.name)} ${format.name} project: no ${format.folders} folder in ${root}${linked}`)
  } else if (found.length) format = found[0].adapter
  else {
    const [first, ...others] = ADAPTERS
    throw new CliError(`Not a ${first.name} project: no ${first.folders} folder in ${root}\n`
      + `Nor ${others.map((a) => `${an(a.name)} ${a.name} project (no ${a.folders} folder)`).join(' or ')}.${linked}`)
  }
  const webDir = io.webDir ?? path.join(pkgRoot, 'dist', 'web')
  if (!fs.existsSync(path.join(webDir, 'index.html'))) throw new CliError('Web files are missing. Run: npm run build')

  let srv: Server
  try {
    // Only the default port moves on when taken: a port the user asked for is that port or nothing.
    srv = values.port === undefined ? await startOnFreePort({ root, port, webDir, adapter: format }) : await startServer({ root, port, webDir, adapter: format })
  } catch (e) {
    if (!busy(e)) throw e
    throw new CliError(values.port === undefined
      ? `Ports ${port} to ${port + TRIES - 1} are in use. Try: spec-visualizer --port ${port + TRIES}`
      : `Port ${port} is in use. Try: spec-visualizer --port ${port + 1}`)
  }
  const p = format.scan(root)
  const docs = p.features.reduce((n, f) => n + f.docs.length, 0) + (p.constitution ? 1 : 0) + (p.shared?.length ?? 0)
  const url = `http://127.0.0.1:${srv.port}`
  io.out(`${format.name} project: ${p.features.length} ${format.unit}, ${docs} documents`)
  // When the folder holds more than one format: which one was opened and why, and how to open each of the others.
  const also = asked === undefined ? found.slice(1) : []
  if (also.length) {
    const lost = found[0].adapter.id !== 'spec-kit' && also.some((f) => f.adapter.id === 'spec-kit')
    const names = also.map((f) => `${f.adapter.name} (${f.adapter.id === 'spec-kit' ? 'specs/' : f.why})`)
    const flags = also.map((f) => `--format ${f.adapter.id}`)
    io.out(`Chose ${format.name} (${found[0].why})${lost ? ': specs/ holds no spec-kit documents' : ''}. `
      + `Also found ${names.join(' and ')}; choose ${also.length > 1 ? 'one' : 'it'} with ${flags.join(' or ')}`)
  }
  io.out(`Dashboard: ${url}`)
  if (!values['no-open']) io.open?.(url)
  return srv
}
