#!/usr/bin/env node
/**
 * Seed test incidents via Supabase (same payloads as the web form).
 *
 * Usage:
 *   pnpm seed:test-data              # insert default sample incidents
 *   pnpm seed:test-data -- --dry-run # print payloads without posting
 *   pnpm seed:test-data -- --count 3 # insert first N samples
 *
 * Requires NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY in .env.
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
    // .env optional if var already exported
  }
}

function parseArgs(argv) {
  const opts = { dryRun: false, count: Infinity }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--count') opts.count = Number(argv[++i]) || Infinity
    else if (arg === '--help' || arg === '-h') opts.help = true
  }
  return opts
}

function assertSupabaseEnv() {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_URL in .env (see .env.example).')
  }
  if (!key || key.includes('YOUR_')) {
    throw new Error('Set NUXT_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).')
  }
  return { url, key }
}

async function fetchConfig(supabase) {
  const [locationsRes, typesRes, helpRes] = await Promise.all([
    supabase.from('locations').select('*').eq('active', true).order('name'),
    supabase.from('incident_types').select('*').eq('active', true).order('name'),
    supabase.from('help_options').select('*').eq('active', true).order('name'),
  ])

  if (locationsRes.error) throw new Error(locationsRes.error.message)
  if (typesRes.error) throw new Error(typesRes.error.message)
  if (helpRes.error) throw new Error(helpRes.error.message)

  if (!locationsRes.data?.length) {
    throw new Error('No locations in Supabase — run migrate-from-sheets or seed dimensions first.')
  }

  return {
    locations: locationsRes.data,
    incidentTypes: typesRes.data ?? [],
    helpOptions: helpRes.data ?? [],
  }
}

async function postIncident(supabase, payload, helpOptions) {
  let helpOptionIds = [...(payload.helpOptionIds ?? [])]
  if (payload.ambulanceCalled === true) {
    const help112 = helpOptions.find(
      opt => String(opt.name).trim().toLowerCase() === '112 gebeld',
    )
    if (help112 && !helpOptionIds.includes(help112.id)) {
      helpOptionIds.push(help112.id)
    }
  }

  let description = payload.description.trim()
  if (payload.personsInvolved) {
    description += ` [betrokkenen: ${payload.personsInvolved}]`
  }

  const { data, error } = await supabase.rpc('submit_public_incident', {
    p_department: payload.department,
    p_location_id: payload.locationId,
    p_sector_row: payload.sectorRow,
    p_sector_column: payload.sectorColumn,
    p_incident_type_id: payload.incidentTypeId,
    p_description: description,
    p_help_option_ids: helpOptionIds.join(','),
    p_priority: payload.priority,
    p_reporter: payload.reporter.trim(),
    p_latitude: null,
    p_longitude: null,
  })

  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.incident_id) throw new Error('Missing incident_id in response')
  return row
}

function firstOf(list, predicate) {
  return list.find(predicate)
}

function helpIds(helpOptions, count = 1) {
  return helpOptions.slice(0, count).map(h => h.id)
}

function buildSamples(config) {
  const { locations, incidentTypes, helpOptions } = config

  const loc = (id) => firstOf(locations, l => l.id === id) ?? locations[0]
  const type = (dept, namePart) =>
    firstOf(
      incidentTypes,
      t => t.department === dept && t.name.toLowerCase().includes(namePart.toLowerCase()),
    ) ?? firstOf(incidentTypes, t => t.department === dept)

  const parkeerHelp = helpIds(helpOptions, 2)
  const dienstHelp = helpIds(helpOptions, 1)
  const ehboHelp = helpIds(helpOptions, 1)

  return [
    {
      department: 'Parkeer',
      locationId: loc('loc-hal12').id,
      sectorRow: 'F',
      sectorColumn: 8,
      incidentTypeId: type('Parkeer', 'geblokkeerd').id,
      priority: 'Critical',
      helpOptionIds: parkeerHelp,
      reporter: 'Testdata — Parkeer centralist',
      description: '[TEST] Toegang geblokkeerd bij Hal 12. Voertuig staat dwars op route.',
    },
    {
      department: 'Parkeer',
      locationId: loc('loc-p4').id,
      sectorRow: 'A',
      sectorColumn: 3,
      incidentTypeId: type('Parkeer', 'parkeer').id,
      priority: 'Laag',
      helpOptionIds: parkeerHelp.slice(0, 1),
      reporter: 'Testdata — P4 wacht',
      description: '[TEST] Onjuist geparkeerde auto, geen blokkade.',
    },
    {
      department: 'Dienstverlening',
      locationId: loc('loc-hal8').id,
      sectorRow: 'C',
      sectorColumn: 12,
      incidentTypeId: type('Dienstverlening', 'brand').id,
      priority: 'Hoog',
      helpOptionIds: dienstHelp,
      reporter: 'Testdata — Hal 8 post',
      description: '[TEST] Rookmelding bij foodcourt. Nog geen vlammen zichtbaar.',
    },
    {
      department: 'Dienstverlening',
      locationId: loc('loc-entree-zuid').id,
      sectorRow: 'G',
      sectorColumn: 1,
      incidentTypeId: type('Dienstverlening', 'veiligheid').id,
      priority: 'Middel',
      helpOptionIds: dienstHelp,
      reporter: 'Testdata — Entree Zuid',
      description: '[TEST] Drukte bij ingang, bezoekersstroom vertraagd.',
    },
    {
      department: 'EHBO',
      locationId: loc('loc-hal3').id,
      sectorRow: 'D',
      sectorColumn: 15,
      incidentTypeId: type('EHBO', 'medisch').id,
      priority: 'Critical',
      helpOptionIds: ehboHelp,
      reporter: 'Testdata — EHBO post Hal 3',
      description: '[TEST] Bezoeker kortademig en duizelig.',
      personsInvolved: 1,
      ambulanceCalled: true,
    },
    {
      department: 'EHBO',
      locationId: loc('loc-sector-a').id,
      sectorRow: 'K',
      sectorColumn: 7,
      incidentTypeId: type('EHBO', 'medisch').id,
      priority: 'Hoog',
      helpOptionIds: ehboHelp,
      reporter: 'Testdata — Sector A patrouille',
      description: '[TEST] Kleine snijwond, EHBO ter plaatse.',
      personsInvolved: 1,
      ambulanceCalled: false,
    },
  ]
}

function printHelp() {
  console.log(`Usage: pnpm seed:test-data [-- --dry-run] [-- --count N]

Seeds sample incidents through Supabase (same shape as the web app).
Each row is prefixed with [TEST] in the description for easy filtering.`)
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const { url, key } = assertSupabaseEnv()
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('Fetching config…')
  const config = await fetchConfig(supabase)
  const samples = buildSamples(config).slice(0, opts.count)

  if (opts.dryRun) {
    console.log(`Dry run — would post ${samples.length} incident(s):\n`)
    for (const sample of samples) {
      console.log(JSON.stringify(sample, null, 2))
      console.log('')
    }
    return
  }

  console.log(`Posting ${samples.length} test incident(s)…\n`)
  const created = []

  for (const sample of samples) {
    process.stdout.write(`  ${sample.department} @ ${sample.locationId} … `)
    try {
      const result = await postIncident(supabase, sample, config.helpOptions)
      created.push(result)
      console.log(result.incident_id)
    } catch (err) {
      console.log('FAILED')
      throw err
    }
  }

  console.log(`\nDone. Created ${created.length} incident(s):`)
  for (const row of created) {
    console.log(`  ${row.incident_id}  ${row.timestamp}`)
  }
  console.log('\nOpen /sitrep in the app to verify.')
}

main().catch(err => {
  console.error('\nSeed failed:', err.message || err)
  process.exit(1)
})
