# Apps Script files

Copy **all** of these into the Sheet's Apps Script project:

| File | Purpose |
|------|---------|
| `Setup.gs` | **Clean slate:** `createCleanWorkbook()`, `setupCleanWorkbook()` |
| `Code.gs` | Sync from Form Responses, shared helpers |
| `Relational.gs` | Dimension tabs + migration + Incidents_view |
| `Api.gs` | Web app API (config, submit, incidents, update) |
| `Reference.gs` | Reference tab builder |
| `Locations.gs` | Locations tab builder |
| `Sitrep.gs` | Sitrep dashboard |
| `SeedData.gs` | Test data: run `seedTestIncidents()` in editor |

**Do not add `InstallAll.gs`** — it contains an old `CONFIG` that overrides `Code.gs`.

## New clean workbook (recommended)

```javascript
createCleanWorkbook()
```

See [`docs/CLEAN_SETUP.md`](../docs/CLEAN_SETUP.md).

## Upgrade existing workbook

```javascript
migrateToRelationalSchema()
```

## Redeploy web app

**Deploy → Manage deployments → Edit → New version** (same `/exec` URL)

`InstallAll.gs` is a legacy single-file bundle — prefer the separate files above.
