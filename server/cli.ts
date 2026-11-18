#!/usr/bin/env node
import { CliError, openBrowser, run } from './main.ts'

try {
  // A browser is opened only for a person at a terminal, not for a pipe, a script or an agent.
  await run(process.argv.slice(2), { out: console.log, open: process.stdout.isTTY ? openBrowser : undefined })
} catch (e) {
  if (!(e instanceof CliError)) throw e
  process.stderr.write(e.message + '\n')
  process.exit(1)
}
