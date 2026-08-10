#!/usr/bin/env node
/**
 * One-time migration: Google Sheets API → Supabase Postgres.
 *
 * Usage:
 *   pnpm migrate:from-sheets
 *   pnpm migrate:from-sheets -- --dry-run
 *
 * Requires in .env:
 *   NUXT_PUBLIC_SHEETS_API_URL  — existing Apps Script /exec URL (read source)
 *   NUXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role secret (bypasses RLS)
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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
  } catch {
    // .env optional if vars exported
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false }
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true
    if (arg === '--help' || arg === '-h') opts.help = true
  }
  return opts
}

function assertEnv() {
  const sheetsUrl = process.env.NUXT_PUBLIC_SHEETS_API_URL
  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sheetsUrl || sheetsUrl.includes('YOUR_DEPLOYMENT_ID')) {
    throw new Error('Set NUXT_PUBLIC_SHEETS_API_URL in .env (Sheets /exec URL for import).')
  }
  if (!supabaseUrl) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL in .env.')
  }
  if (!serviceKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env (local only, never commit).')
  }

  return { sheetsUrl, supabaseUrl, serviceKey }
}

async function fetchSheetsConfig(sheetsUrl) {
  const res = await fetch(`${sheetsUrl}?action=config`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Sheets config failed: HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data
}

async function fetchSheetsIncidents(sheetsUrl) {
  const res = await fetch(`${sheetsUrl}?action=incidents`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Sheets incidents failed: HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data ?? []
}

function toIso(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function helpIdsCsv(helpOptionIds) {
  if (!helpOptionIds?.length) return ''
  return helpOptionIds.join(',')
}

function buildIncidentRow(incident) {
  return {
    incident_id: incident.incidentId,
    timestamp: toIso(incident.timestamp) ?? new Date().toISOString(),
    department: incident.department,
    location_id: incident.locationId || null,
    sector_row: incident.sectorRow ?? '',
    sector_column: incident.sectorColumn ?? null,
    sector_label: incident.sectorLabel ?? '',
    incident_type_id: incident.incidentTypeId || null,
    description: incident.description ?? '',
    help_option_ids: helpIdsCsv(incident.helpOptionIds),
    priority: incident.priority,
    reporter: incident.reporter ?? '',
    status: incident.status || 'Open',
    action_owner: incident.actionOwner ?? '',
    deadline: toIso(incident.deadline),
    closed_by: incident.closedBy ?? '',
    closure_result: incident.closureResult ?? '',
    source_row: incident.sourceRow || 'sheet',
    latitude: incident.latitude ?? null,
    longitude: incident.longitude ?? null,
    free_field: incident.freeField ?? '',
    scenario: incident.scenario ?? '',
    flag_ehbo: incident.flagEhbo === true,
    flag_beveiliging: incident.flagBeveiliging === true,
    flag_hc_safety: incident.flagHcSafety === true,
    flag_reiniging: incident.flagReiniging === true,
    flag_veiligheid: incident.flagVeiligheid === true,
    updated_at: toIso(incident.lastUpdate) ?? toIso(incident.timestamp) ?? new Date().toISOString(),
  }
}

function buildUpdatePayload(incident) {
  return {
    department: incident.department,
    locationId: incident.locationId ?? '',
    sectorRow: incident.sectorRow ?? '',
    sectorColumn: incident.sectorColumn ?? null,
    sectorLabel: incident.sectorLabel ?? '',
    incidentTypeId: incident.incidentTypeId ?? '',
    description: incident.description ?? '',
    helpOptionIds: incident.helpOptionIds ?? [],
    priority: incident.priority,
    reporter: incident.reporter ?? '',
    freeField: incident.freeField ?? '',
    flagEhbo: incident.flagEhbo === true,
    flagBeveiliging: incident.flagBeveiliging === true,
    flagHcSafety: incident.flagHcSafety === true,
    flagReiniging: incident.flagReiniging === true,
    flagVeiligheid: incident.flagVeiligheid === true,
    actionOwner: incident.actionOwner ?? '',
    scenario: incident.scenario ?? '',
    deadline: incident.deadline || undefined,
    closedBy: incident.closedBy ?? '',
    closureResult: incident.closureResult ?? '',
    latitude: incident.latitude ?? null,
    longitude: incident.longitude ?? null,
    timestamp: incident.timestamp || undefined,
  }
}

function buildUpdateRow(incident) {
  const createdAt = toIso(incident.lastUpdate) ?? toIso(incident.timestamp) ?? new Date().toISOString()
  return {
    incident_id: incident.incidentId,
    created_at: createdAt,
    status: incident.status || 'Open',
    notes: incident.updateNotes ?? '',
    updated_by: incident.closedBy || incident.actionOwner || incident.reporter || '',
    payload: buildUpdatePayload(incident),
  }
}

/** Keep last row per conflict key — avoids PG "cannot affect row a second time" on batch upsert. */
function dedupeByKey(rows, key) {
  const byKey = new Map()
  for (const row of rows) {
    byKey.set(row[key], row)
  }
  return [...byKey.values()]
}

async function upsertBatch(supabase, table, rows, onConflict) {
  if (!rows.length) return 0
  const deduped = dedupeByKey(rows, onConflict)
  const { error } = await supabase.from(table).upsert(deduped, { onConflict })
  if (error) throw new Error(`${table} upsert: ${error.message}`)
  return deduped.length
}

async function insertBatch(supabase, table, rows) {
  if (!rows.length) return 0
  const { error } = await supabase.from(table).insert(rows)
  if (error) throw new Error(`${table} insert: ${error.message}`)
  return rows.length
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: pnpm migrate:from-sheets [-- --dry-run]')
    return
  }

  const { sheetsUrl, supabaseUrl, serviceKey } = assertEnv()

  console.log('Fetching Sheets config + incidents…')
  const [config, incidents] = await Promise.all([
    fetchSheetsConfig(sheetsUrl),
    fetchSheetsIncidents(sheetsUrl),
  ])

  const locationRowsRaw = (config.locations ?? []).map(loc => ({
    id: loc.id,
    name: loc.name,
    zone: loc.zone ?? '',
    active: loc.active !== false,
  }))

  const typeRowsRaw = (config.incidentTypes ?? []).map(type => ({
    id: type.id,
    department: type.department,
    name: type.name,
    active: true,
  }))

  const helpRowsRaw = (config.helpOptions ?? []).map(opt => ({
    id: opt.id,
    name: opt.name,
    departments: opt.departments ?? ['Parkeer', 'Dienstverlening', 'EHBO'],
    active: true,
  }))

  const incidentRowsRaw = incidents.map(buildIncidentRow)
  const updateRowsRaw = incidents.map(buildUpdateRow)

  const locationRows = dedupeByKey(locationRowsRaw, 'id')
  const typeRows = dedupeByKey(typeRowsRaw, 'id')
  const helpRows = dedupeByKey(helpRowsRaw, 'id')
  const incidentRows = dedupeByKey(incidentRowsRaw, 'incident_id')
  const updateRows = dedupeByKey(updateRowsRaw, 'incident_id')
  const incidentIds = incidentRows.map(row => row.incident_id)

  const logDedupe = (label, raw, deduped) => {
    const dropped = raw.length - deduped.length
    if (dropped > 0) console.log(`  ${label}: ${raw.length} → ${deduped.length} (${dropped} duplicate id(s) removed)`)
    else console.log(`  ${label}: ${deduped.length}`)
  }

  console.log('\nSource counts (after dedupe):')
  logDedupe('locations', locationRowsRaw, locationRows)
  logDedupe('incident_types', typeRowsRaw, typeRows)
  logDedupe('help_options', helpRowsRaw, helpRows)
  logDedupe('incidents', incidentRowsRaw, incidentRows)
  logDedupe('incident_updates', updateRowsRaw, updateRows)

  if (opts.dryRun) {
    console.log('\nDry run — no writes performed.')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('\nUpserting dimensions + incidents…')
  await upsertBatch(supabase, 'locations', locationRows, 'id')
  await upsertBatch(supabase, 'incident_types', typeRows, 'id')
  await upsertBatch(supabase, 'help_options', helpRows, 'id')
  await upsertBatch(supabase, 'incidents', incidentRows, 'incident_id')

  if (incidentIds.length) {
    console.log('Replacing incident_updates for migrated incidents…')
    const { error: deleteError } = await supabase
      .from('incident_updates')
      .delete()
      .in('incident_id', incidentIds)
    if (deleteError) throw new Error(`incident_updates delete: ${deleteError.message}`)
    await insertBatch(supabase, 'incident_updates', updateRows)
  }

  const [locCount, typeCount, helpCount, incCount, updCount] = await Promise.all([
    countTable(supabase, 'locations'),
    countTable(supabase, 'incident_types'),
    countTable(supabase, 'help_options'),
    countTable(supabase, 'incidents'),
    countTable(supabase, 'incident_updates'),
  ])

  console.log('\nSupabase row counts:')
  console.log(`  locations:        ${locCount}${locCount === locationRows.length ? ' ✓' : ''}`)
  console.log(`  incident_types:   ${typeCount}${typeCount === typeRows.length ? ' ✓' : ''}`)
  console.log(`  help_options:     ${helpCount}${helpCount === helpRows.length ? ' ✓' : ''}`)
  console.log(`  incidents:        ${incCount}${incCount >= incidentRows.length ? ' ✓' : ''}`)
  console.log(`  incident_updates: ${updCount}${updCount >= updateRows.length ? ' ✓' : ''}`)
  console.log('\nMigration complete.')
}

main().catch(err => {
  console.error('\nMigration failed:', err.message || err)
  process.exit(1)
})
