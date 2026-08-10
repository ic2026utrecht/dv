# Clean slate — new Google Sheet

Use this when the old workbook is messy. You get empty **Incidents**, correct relational tabs, and no legacy Form Response import.

## Option A — One click (easiest)

Run from **any** Apps Script project that has all `.gs` files (including **`Setup.gs`**):

```javascript
createCleanWorkbook()
```

1. Open **Extensions → Apps Script** on your current sheet (or a blank project)
2. Paste/update all files from `apps-script/` (must include `Setup.gs`; **do not** add `InstallAll.gs`)
3. Select **`createCleanWorkbook`** → **Run**
4. Open **Executions** log — copy the **Spreadsheet URL** and **ID**

This creates a new file **"IC2026 DV — Incidents"** in your Google Drive with:

| Tab | Contents |
|-----|----------|
| Reference | Priorities, status, legacy lists |
| Locations | 22 locations with `id` / `zone` |
| IncidentTypes | All incident types with IDs |
| HelpOptions | Hulp options with IDs |
| Incidents | Empty fact table (relational headers) |
| Incidents_view | Empty display layer |
| Sitrep | Dashboard (0 incidents) |

## Option B — New sheet you create

1. Create a blank Google Sheet
2. **Extensions → Apps Script** → paste all `apps-script/` files
3. Run **`setupCleanWorkbook()`**
4. The script saves this sheet’s ID automatically for the web app

## Deploy the API

1. In the **same** Apps Script project: **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
2. Copy the **`/exec`** URL

If you used Option A from the **old** sheet’s script project, the deployment lives there but reads/writes the **new** sheet (via Script Property). That’s fine.

For a cleaner setup, bind the script to the **new** sheet instead:

1. Open the new workbook → **Extensions → Apps Script**
2. Paste all `.gs` files **except `InstallAll.gs`** → run **`setupCleanWorkbook()`**
3. Deploy web app from **this** project

## Point the web app at the new API

Update the `/exec` URL in:

- Local `.env` → `NUXT_PUBLIC_SHEETS_API_URL`
- GitHub **Settings → Variables** → `NUXT_PUBLIC_SHEETS_API_URL`
- Redeploy GitHub Pages (push to `main`) if needed

## Verify

1. Run **`setupCleanWorkbook()`** first (creates all tabs)
2. If tabs are still missing, run **`repairCleanWorkbook()`** (adds missing tabs only)
3. Then run **`auditWorkbook()`**

Check the execution log for `OK` on all tabs and confirm the **URL** matches your new workbook.

```javascript
auditWorkbook()
```

Test in browser:

```
{your-exec-url}?action=config
```

Should return JSON with locations and incident types.

Submit one test incident from the form — **Incidents** should show `location_id` like `loc-hal11`, not plain text names.

## Old sheet

Keep the old workbook as archive if you want. The web app will ignore it once you update `NUXT_PUBLIC_SHEETS_API_URL`.

To import old Form Responses later (optional):

1. Copy the **Form Responses** tab into the new workbook
2. Rename it **Form Responses 1**
3. Run **`syncIncidentsFromResponses()`**
