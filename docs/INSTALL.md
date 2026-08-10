# Install checklist

## 1. Google Sheet (Apps Script)

1. Open https://docs.google.com/spreadsheets/d/1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q/edit
2. **Extensions → Apps Script**
3. Paste all files from `apps-script/`:
   - `Code.gs`, `Api.gs`, `Relational.gs`, `Reference.gs`, `Locations.gs`, `Sitrep.gs`
4. **Existing workbook:** run **`migrateToRelationalSchema`** once  
   **Fresh sheet:** run **`setupWorkbook`**
5. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**  
   (keeps the same `/exec` URL)
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **/exec** URL if this is your first deploy

## 2. GitHub repository

1. Repo: https://github.com/Brighterflow/ic2026
2. **Settings → Secrets and variables → Actions → Variables**
   - Add `NUXT_PUBLIC_SHEETS_API_URL` = your `/exec` URL
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. Push to `main` — workflow deploys to https://brighterflow.github.io/ic2026/

## 3. Local dev

```bash
pnpm install
cp .env.example .env
# paste /exec URL in .env
pnpm dev
```

## 4. Verify

- [ ] GET `{execUrl}?action=config` returns JSON with locations + incident types
- [ ] Form loads on GitHub Pages
- [ ] Test submit → new row on **Incidents** with `location_id` / `incident_type_id` (not copied names)
- [ ] **Incidents_view** shows readable names
- [ ] GET `{execUrl}?action=incidents` returns incident rows
- [ ] GET `{execUrl}?action=update&payload={"incidentId":"INC-2026-001","status":"Open"}` does **not** return `Unknown action`
- [ ] Sitrep dashboard: click incident → change status → saves to **Incidents** tab

## Sheet tabs after setup

| Tab | Purpose |
|-----|---------|
| Locations | Locatie dimension (`id`, `name`, `zone`) |
| IncidentTypes | Incidenttype dimension |
| HelpOptions | Hulp dimension |
| Reference | Priority/status + legacy lists |
| Incidents | Fact table (foreign keys) + ops status |
| Incidents_view | Human-readable join (Sitrep reads this) |
| Sitrep | Dashboard |
| Form Responses 1 | Legacy archive (optional) |

## Useful script functions

| Function | When |
|----------|------|
| `migrateToRelationalSchema()` | One-time upgrade of existing Incidents data |
| `syncIncidentsFromResponses()` | Re-import all form responses |
| `refreshIncidentsView()` | Rebuild display tab after manual Incidents edits |
| `refreshSitrep()` | Rebuild Sitrep layout |
