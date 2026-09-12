// Database helper: runs the pinned Supabase CLI against the remote database
// described by SUPABASE_DB_URL in .env.local.
//
// Usage:
//   node scripts/db.mjs push   -> apply pending migrations in supabase/migrations
//   node scripts/db.mjs seed   -> execute supabase/seed.sql against the database
//   node scripts/db.mjs types  -> regenerate types/database.ts (requires Docker)
//   node scripts/db.mjs config -> push supabase/config.toml (auth settings and
//                                 email templates) to the hosted project;
//                                 add --yes to skip the confirmation gate
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const supabaseBin = require.resolve('supabase/dist/supabase.js')

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function readEnv(key) {
  const fileEnv = loadEnvFile(resolve(projectRoot, '.env.local'))
  return process.env[key] ?? fileEnv[key]
}

function resolveDbUrl() {
  const url = readEnv('SUPABASE_DB_URL')
  if (!url) {
    console.error(
      'SUPABASE_DB_URL is not set (checked process.env and .env.local).',
    )
    process.exit(1)
  }
  return url
}

// `config push` targets a project ref rather than a database URL. Prefer an
// explicit SUPABASE_PROJECT_REF, else derive it from the public Supabase URL
// (`https://<ref>.supabase.co`).
function resolveProjectRef() {
  const explicit = readEnv('SUPABASE_PROJECT_REF')
  if (explicit) return explicit
  const supabaseUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const match = supabaseUrl
    ? /^https?:\/\/([a-z]{20})\.supabase\.(co|in)\b/.exec(supabaseUrl)
    : null
  if (match) return match[1]
  console.error(
    'Could not determine the Supabase project ref. Set SUPABASE_PROJECT_REF ' +
      'in .env.local (or NEXT_PUBLIC_SUPABASE_URL to https://<ref>.supabase.co), ' +
      'or link the project once with `npx supabase link`.',
  )
  process.exit(1)
}

function runSupabase(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [supabaseBin, ...args], {
    cwd: projectRoot,
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  return result.stdout ?? ''
}

const commands = {
  push() {
    runSupabase(['db', 'push', '--db-url', resolveDbUrl(), '--yes'])
  },
  // `db query` executes exactly one statement and `db push --include-seed`
  // only seeds when migrations are pending, so the seed (pure DML) is wrapped
  // in a single DO block. That keeps it re-runnable and atomic.
  seed() {
    const dbUrl = resolveDbUrl()
    const seedSql = readFileSync(
      resolve(projectRoot, 'supabase/seed.sql'),
      'utf8',
    )
    const tag = '$tienda_seed$'
    if (seedSql.includes(tag)) {
      console.error(
        `supabase/seed.sql must not contain the dollar-quote tag ${tag}.`,
      )
      process.exit(1)
    }
    const wrapped = `do ${tag}\nbegin\n${seedSql}\nend\n${tag};\n`
    const wrappedPath = resolve(tmpdir(), `tienda-seed-${process.pid}.sql`)
    writeFileSync(wrappedPath, wrapped)
    try {
      runSupabase([
        'db',
        'query',
        '--db-url',
        dbUrl,
        '--file',
        wrappedPath,
        '--yes',
      ])
      console.log('Seed applied from supabase/seed.sql')
    } finally {
      rmSync(wrappedPath, { force: true })
    }
  },
  types() {
    const output = runSupabase(
      [
        'gen',
        'types',
        'typescript',
        '--db-url',
        resolveDbUrl(),
        '--schema',
        'public',
      ],
      { capture: true },
    )
    if (!output.includes('export type Database')) {
      console.error(
        'Type generation produced no Database type; nothing written.',
      )
      process.exit(1)
    }
    mkdirSync(resolve(projectRoot, 'types'), { recursive: true })
    writeFileSync(resolve(projectRoot, 'types/database.ts'), output)
    console.log('Wrote types/database.ts')
  },
  // Pushes the auth settings and email templates declared in
  // supabase/config.toml to the hosted project. Needs a CLI session
  // (`npx supabase login` or SUPABASE_ACCESS_TOKEN). The diff is shown first
  // and nothing is pushed until the operator types `yes` (or passes --yes):
  // config.toml also declares values the local template wrote, and the CLI
  // proceeds by default when it is not attached to a TTY. `config push` is
  // still run without --yes so the CLI's own per-resource prompt applies too.
  async config() {
    const projectRef = resolveProjectRef()
    console.log(`Diffing supabase/config.toml against project ${projectRef}…`)
    runSupabase(['config', 'diff', '--project-ref', projectRef])
    if (!(await confirmConfigPush(projectRef))) {
      console.error('Aborted: nothing was pushed.')
      process.exit(1)
    }
    runSupabase(['config', 'push', '--project-ref', projectRef])
  },
}

async function confirmConfigPush(projectRef) {
  if (flags.has('--yes')) return true
  if (!process.stdin.isTTY) {
    console.error(
      'Refusing to push config without confirmation: stdin is not a terminal. ' +
        'Review the diff above and re-run with `npm run db:config -- --yes`.',
    )
    return false
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(
      `Push this config to project ${projectRef}? Only 'yes' continues: `,
    )
    return answer.trim() === 'yes'
  } finally {
    rl.close()
  }
}

const [command, ...rest] = process.argv.slice(2)
const flags = new Set(rest)
if (!command || !(command in commands)) {
  console.error(
    `Usage: node scripts/db.mjs <${Object.keys(commands).join('|')}> [--yes]`,
  )
  process.exit(1)
}

await commands[command]()
