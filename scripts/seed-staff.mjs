#!/usr/bin/env node
/**
 * Seed staff allowlist into public.staff (first bootstrap before /admin UI).
 *
 * Usage:
 *   pnpm seed:staff
 *   pnpm seed:staff -- --dry-run
 *   pnpm seed:staff -- --phone +31612345678 --first Ramon --last Staal
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NUXT_PUBLIC_SUPABASE_URL in .env.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** Default bootstrap row — override with CLI flags or STAFF_SEED_JSON */
const DEFAULT_STAFF = [
  {
    first_name: 'Ramon',
    last_name: 'Staal',
    phone: '+31600000000',
  },
]

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
  const opts = {
    dryRun: false,
    help: false,
    phone: null,
    first: null,
    last: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--phone') opts.phone = argv[++i]
    else if (arg === '--first') opts.first = argv[++i]
    else if (arg === '--last') opts.last = argv[++i]
  }
  return opts
}

/** Normalize NL-friendly phone input to E.164 */
export function normalizePhone(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`
  }
  const only = digits.replace(/\D/g, '')
  if (only.startsWith('0') && only.length === 10) {
    return `+31${only.slice(1)}`
  }
  if (only.startsWith('31') && only.length >= 11) {
    return `+${only}`
  }
  if (only.length >= 9) {
    return `+${only}`
  }
  return only ? `+${only}` : ''
}

function assertEnv() {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL in .env')
  }
  if (!key || key.includes('YOUR_')) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env (scripts only — never expose to the client)')
  }
  return { url, key }
}

function resolveRows(opts) {
  if (opts.phone || opts.first || opts.last) {
    if (!opts.phone || !opts.first || !opts.last) {
      throw new Error('When using flags, provide --phone, --first, and --last together.')
    }
    return [{
      first_name: opts.first.trim(),
      last_name: opts.last.trim(),
      phone: normalizePhone(opts.phone),
    }]
  }
  if (process.env.STAFF_SEED_JSON) {
    const parsed = JSON.parse(process.env.STAFF_SEED_JSON)
    if (!Array.isArray(parsed)) throw new Error('STAFF_SEED_JSON must be a JSON array')
    return parsed.map(row => ({
      first_name: String(row.first_name ?? row.firstName ?? '').trim(),
      last_name: String(row.last_name ?? row.lastName ?? '').trim(),
      phone: normalizePhone(row.phone),
    }))
  }
  return DEFAULT_STAFF.map(row => ({
    ...row,
    phone: normalizePhone(row.phone),
  }))
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(`Usage:
  pnpm seed:staff
  pnpm seed:staff -- --dry-run
  pnpm seed:staff -- --phone +31612345678 --first Ramon --last Staal

Edit DEFAULT_STAFF in scripts/seed-staff.mjs or set STAFF_SEED_JSON.
Requires SUPABASE_SERVICE_ROLE_KEY.`)
    return
  }

  const rows = resolveRows(opts)
  for (const row of rows) {
    if (!row.first_name || !row.last_name || !row.phone) {
      throw new Error(`Invalid staff row: ${JSON.stringify(row)}`)
    }
    if (!/^\+[1-9][0-9]{7,14}$/.test(row.phone)) {
      throw new Error(`Phone must be E.164 (e.g. +31612345678): ${row.phone}`)
    }
  }

  console.log(`Seeding ${rows.length} staff row(s)${opts.dryRun ? ' (dry-run)' : ''}…`)
  for (const row of rows) {
    console.log(`  - ${row.first_name} ${row.last_name} <${row.phone}>`)
  }

  if (opts.dryRun) return

  const { url, key } = assertEnv()
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (const row of rows) {
    const { data, error } = await supabase
      .from('staff')
      .upsert(row, { onConflict: 'phone' })
      .select('id, first_name, last_name, phone, pin_set_at')
      .single()

    if (error) throw new Error(error.message)
    console.log(`  ok ${data.first_name} ${data.last_name} (${data.phone}) pin_set=${Boolean(data.pin_set_at)}`)
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
