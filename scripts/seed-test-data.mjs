#!/usr/bin/env node
/**
 * Seed test incidents via the deployed Apps Script Web App (same path as the Nuxt form).
 *
 * Usage:
 *   pnpm seed:test-data              # insert default sample incidents
 *   pnpm seed:test-data -- --dry-run # print payloads without posting
 *   pnpm seed:test-data -- --count 3 # insert first N samples
 *
 * Requires NUXT_PUBLIC_SHEETS_API_URL in .env (copy from .env.example).
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
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

function assertApiUrl(url) {
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    throw new Error(
      'Set NUXT_PUBLIC_SHEETS_API_URL in .env to your deployed /exec URL (see .env.example).',
    )
  }
}

async function fetchConfig(apiUrl) {
  const res = await fetch(`${apiUrl}?action=config`, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Config request failed: HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  if (!json.data?.locations?.length) {
    throw new Error('Config returned no locations — run setupCleanWorkbook() in Apps Script first.')
  }
  return json.data
}

async function postIncident(apiUrl, payload) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (json.error) throw new Error(json.error)
  if (!json.data?.incidentId) throw new Error('Missing incidentId in response')
  return json.data
}

function firstOf(list, predicate) {
  return list.find(predicate)
}

function helpForDepartment(helpOptions, department, count = 1) {
  return helpOptions
    .filter((h) => h.departments.includes(department))
    .slice(0, count)
    .map((h) => h.id)
}

function buildSamples(config) {
  const { locations, incidentTypes, helpOptions } = config

  const loc = (id) => firstOf(locations, (l) => l.id === id) ?? locations[0]
  const type = (dept, namePart) =>
    firstOf(
      incidentTypes,
      (t) => t.department === dept && t.name.toLowerCase().includes(namePart.toLowerCase()),
    ) ?? firstOf(incidentTypes, (t) => t.department === dept)

  const parkeerHelp = helpForDepartment(helpOptions, 'Parkeer', 2)
  const dienstHelp = helpForDepartment(helpOptions, 'Dienstverlening', 1)
  const ehboHelp = helpForDepartment(helpOptions, 'EHBO', 1)

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

Seeds sample incidents through the same Apps Script API as the web app.
Each row is prefixed with [TEST] in the description for easy filtering.`)
}

async function main() {
  loadEnv()
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const apiUrl = process.env.NUXT_PUBLIC_SHEETS_API_URL
  assertApiUrl(apiUrl)

  console.log('Fetching config…')
  const config = await fetchConfig(apiUrl)
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
      const result = await postIncident(apiUrl, sample)
      created.push(result)
      console.log(result.incidentId)
    } catch (err) {
      console.log('FAILED')
      throw err
    }
  }

  console.log(`\nDone. Created ${created.length} incident(s):`)
  for (const row of created) {
    console.log(`  ${row.incidentId}  ${row.timestamp}`)
  }
  console.log('\nOpen the Sheet → Incidents_view or Sitrep tab to verify.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message || err)
  process.exit(1)
})
