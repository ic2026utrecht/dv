# IC2026 DV — Incident Form (GitHub Pages)

Nuxt 3 / Vue 3 / PrimeVue web app for incident registration during IC2026 DV.  
**Google Sheets** remains the single source of truth via a deployed **Apps Script Web App**.

| Resource | URL |
|----------|-----|
| Sheet | https://docs.google.com/spreadsheets/d/1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q/edit |
| GitHub | https://github.com/ramonstaal/ic |
| Live app | https://ramonstaal.github.io/ic/ (after Pages deploy) |

## Architecture

```
GitHub Pages (Nuxt SPA)
    ↓ GET ?action=config / POST incident
Apps Script Web App (Api.gs)
    ↓ read/write
Google Sheet
  ├── Locations      ← location dropdown (relational)
  ├── Reference      ← incident types, hulp, prioriteit
  ├── Incidents      ← normalized rows + ops columns
  └── Sitrep         ← dashboard (formulas)
```

Form inputs are mostly **selects**:
- **Locatie** → `Locations` tab (`id`, `name`, `zone`, `active`)
- **Sector** → raster rij **A–M** + kolom **1–22** (stored as e.g. `E7`)
- **Soort incident** → `Reference` tab, filtered by afdeling
- **Hulp** → multi-select from `Reference`, filtered by afdeling

## Project structure (frontend handbook)

```
app/
├── components/incident/   IncidentForm.vue
├── components/layout/     PageHeader.vue
├── composables/           useIncidents.ts
├── plugins/               api.ts
├── repository/modules/    incidents.ts
├── stores/                incidentConfig.ts
├── types/                 models.ts, api.ts, nuxt.d.ts
├── utils/                 incidentOptions.ts
└── pages/                 index.vue, success.vue
apps-script/               Sheet backend + Web API
```

## Local development

```bash
pnpm install
cp .env.example .env
# Set NUXT_PUBLIC_SHEETS_API_URL to your deployed /exec URL
pnpm dev
```

## Google Sheet setup

1. Open the Sheet → **Extensions → Apps Script**
2. Paste all files from `apps-script/` (`Code.gs`, `Reference.gs`, `Locations.gs`, `Sitrep.gs`, `Api.gs`)
3. Run **`setupWorkbook`**
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the `/exec` URL into:
   - Local `.env` → `NUXT_PUBLIC_SHEETS_API_URL`
   - GitHub repo **Settings → Secrets and variables → Actions → Variables** → `NUXT_PUBLIC_SHEETS_API_URL`

## GitHub Pages

1. Push to `main` on https://github.com/ramonstaal/ic
2. **Settings → Pages → Build and deployment → GitHub Actions**
3. Workflow `.github/workflows/deploy-pages.yml` builds with `pnpm generate` and deploys `.output/public`

## Managing lists (no code deploy needed)

| Tab | Edit to change |
|-----|----------------|
| **Locations** | Locatie dropdown (add rows: `id`, `name`, `zone`, `active`) |
| **Reference** cols L/P/N | Incident types per afdeling |
| **Reference** cols R/S | Hulp options + which afdelingen |

Raster rows/columns are fixed A–M × 1–22 (see `public/raster-map.png`).

## Docs

- [`docs/OPERATOR_GUIDE.md`](docs/OPERATOR_GUIDE.md) — melder & ops
- [`docs/FORM_REDESIGN.md`](docs/FORM_REDESIGN.md) — legacy Google Form notes
- [`docs/INSTALL.md`](docs/INSTALL.md) — Sheet install checklist
