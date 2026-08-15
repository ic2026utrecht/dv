#!/usr/bin/env node
/**
 * Restore table data from a backups/full-* folder created by backup-database.mjs.
 *
 * Usage:
 *   pnpm restore:db -- --dir backups/full-... --dry-run
 *   pnpm restore:db -- --dir backups/full-... --tables locations,help_options --confirm
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. Destructive — upserts by primary key where possible.
 * Does NOT drop tables or re-run migrations.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TABLE_PK = {
  locations: 'id',
  incident_types: 'id',
  help_options: 'id',
  incidents: 'incident_id',
  incident_updates: 'id',
  incident_status_updates: 'id',
  incident_update_feed_reads: 'id',
  staff: 'id',
  whatsapp_instances: 'id',
  whatsapp_groups: 'id',
  whatsapp_messages: 'id',
  whatsapp_message_actions: 'id',
  raster_maps: 'id',
}

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
    // optional
  }
}

function parseArgs(argv) {
  const opts = { dir: null, tables: null, dryRun: false, confirm: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--confirm') opts.confirm = true
    else if (arg === '--dir') opts.dir = argv[++i]
    else if (arg === '--tables') opts.tables = (argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return opts
}

function assertEnv() {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  }
  return { url, key }
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || !opts.dir) {
    console.log(`Usage: pnpm restore:db -- --dir backups/full-... [--tables a,b] [--dry-run] [--confirm]`)
    process.exit(opts.help ? 0 : 1)
  }

  if (!opts.dryRun && !opts.confirm) {
    throw new Error('Refusing to restore without --confirm (or use --dry-run)')
  }

  const backupDir = resolve(ROOT, opts.dir)
  if (!existsSync(join(backupDir, 'manifest.json'))) {
    throw new Error(`No manifest.json in ${backupDir}`)
  }

  const manifest = JSON.parse(readFileSync(join(backupDir, 'manifest.json'), 'utf8'))
  const tables = opts.tables ?? Object.keys(manifest.counts || TABLE_PK).filter(t => TABLE_PK[t])

  console.log(`Restore from ${backupDir}`)
  console.log(`Created: ${manifest.created_at} label=${manifest.label ?? '—'}`)
  if (opts.dryRun) console.log('DRY RUN — no writes')

  const { url, key } = assertEnv()
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const table of tables) {
    const file = join(backupDir, `${table}.json`)
    if (!existsSync(file)) {
      console.warn(`  skip ${table}: no file`)
      continue
    }
    const rows = JSON.parse(readFileSync(file, 'utf8'))
    const pk = TABLE_PK[table]
    console.log(`  ${table}: ${rows.length} rows (pk=${pk})`)
    if (opts.dryRun || !rows.length) continue

    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await client.from(table).upsert(chunk, { onConflict: pk })
      if (error) throw new Error(`${table}: ${error.message}`)
    }
  }

  console.log(opts.dryRun ? '\nDry run complete.' : '\nRestore complete.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
