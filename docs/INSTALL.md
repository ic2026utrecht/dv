# Install checklist

## 1. Google Sheet (Apps Script)

1. Open https://docs.google.com/spreadsheets/d/1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q/edit
2. **Extensions → Apps Script**
3. Paste `apps-script/InstallAll.gs` (or separate `.gs` files including **Api.gs**)
4. Run **`setupWorkbook`**
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **/exec** URL

## 2. GitHub repository

1. Repo: https://github.com/ramonstaal/ic
2. **Settings → Secrets and variables → Actions → Variables**
   - Add `NUXT_PUBLIC_SHEETS_API_URL` = your `/exec` URL
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. Push to `main` — workflow deploys to https://ramonstaal.github.io/ic/

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
- [ ] Test submit → new row on **Incidents** tab
- [ ] **Sitrep** tab updates open counts

## Sheet tabs after setup

| Tab | Purpose |
|-----|---------|
| Locations | Locatie dropdown (edit rows here) |
| Reference | Incident types + hulp per afdeling |
| Incidents | Normalized data + ops status |
| Sitrep | Dashboard |
| Form Responses 1 | Legacy archive (optional) |
