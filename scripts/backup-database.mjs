#!/usr/bin/env node
/**
 * Full database backup: all public tables as JSON + schema snapshot from migrations.
 *
 * Usage:
 *   pnpm backup:db
 *   pnpm backup:db -- --label pre-raster-maps
 *
 * Requires NUXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.
 * Output: backups/full-<ISO-timestamp>/ (gitignored — contains staff phone numbers)
 */

import { execSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TABLES = [
  'locations',
  'incident_types',
  'help_options',
  'incidents',
  'incident_updates',
  'incident_status_updates',
  'incident_update_feed_reads',
  'staff',
  'whatsapp_instances',
  'whatsapp_groups',
  'whatsapp_messages',
  'whatsapp_message_actions',
  'raster_maps',
]

const PAGE_SIZE = 1000

function loadEnv() {
  const path = join(ROOT, '.env')
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
  catch {
    // .env optional if vars already exported
  }
}

function parseArgs(argv) {
  const opts = { label: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--label') opts.label = argv[++i] ?? null
  }
  return opts
}

function assertEnv() {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in .env')
  }
  if (!key || key.includes('YOUR_')) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env (service role, not anon key)')
  }
  return { url, key }
}

function gitCommit() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  }
  catch {
    return null
  }
}

function listMigrationFiles() {
  const dir = join(ROOT, 'supabase/migrations')
  return readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .sort()
}

function writeSchemaSnapshot(outDir, migrations) {
  const parts = migrations.map((name) => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations', name), 'utf8')
    return `-- ========== ${name} ==========\n${sql.trim()}\n`
  })
  writeFileSync(join(outDir, 'schema.sql'), parts.join('\n'), 'utf8')
}

async function fetchAllRows(client, table) {
  const rows = []
  let from = 0
  for (;;) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await client.from(table).select('*').range(from, to)
    if (error) {
      if (error.code === '42P01' || /does not exist|relation/i.test(error.message)) {
        console.warn(`  skip ${table}: ${error.message}`)
        return null
      }
      throw new Error(`${table}: ${error.message}`)
    }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(`Usage: pnpm backup:db [-- --label <name>]

Exports all public tables to backups/full-<timestamp>/
Requires SUPABASE_SERVICE_ROLE_KEY and NUXT_PUBLIC_SUPABASE_URL.`)
    process.exit(0)
  }

  const { url, key } = assertEnv()
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const createdAt = new Date()
  const stamp = createdAt.toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z')
  const folderName = opts.label
    ? `full-${stamp}-${opts.label.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : `full-${stamp}`
  const outDir = join(ROOT, 'backups', folderName)
  mkdirSync(outDir, { recursive: true })

  const migrations = listMigrationFiles()
  writeSchemaSnapshot(outDir, migrations)

  const counts = {}
  console.log(`Backing up to ${outDir}`)

  for (const table of TABLES) {
    process.stdout.write(`  ${table}... `)
    const rows = await fetchAllRows(client, table)
    if (rows === null) {
      counts[table] = null
      continue
    }
    writeFileSync(join(outDir, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
    counts[table] = rows.length
    console.log(`${rows.length} rows`)
  }

  const projectHost = (() => {
    try {
      return new URL(url).hostname.split('.')[0]
    }
    catch {
      return url
    }
  })()

  const manifest = {
    created_at: createdAt.toISOString(),
    label: opts.label,
    project: projectHost,
    supabase_url: url.replace(/\/\/.*@/, '//***@'),
    git_commit: gitCommit(),
    migrations,
    counts,
    note: 'Contains staff PII (phones). Keep local; do not commit backups/full-*/',
  }
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log('\nManifest counts:')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count === null ? 'skipped' : count}`)
  }
  console.log(`\nDone: ${outDir}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
