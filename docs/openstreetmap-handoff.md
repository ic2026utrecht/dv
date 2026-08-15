# OpenStreetMap / raster maps — handoff

**Branch:** `feat/openstreetmap`  
**Status:** Work in progress — not ready to merge to `main`  
**Last updated:** 2026-08-15

---

## Goal

Add a **Raster ↔ Kaart (OSM)** toggle on the Sitrep map so incident sectors appear on both:

1. The existing PNG raster grid (pinch/zoom).
2. An OpenStreetMap view with a georeferenced PNG overlay and sector markers.

Also provide **Admin → Kaarten** to manage multiple venue maps, grid bounds, geo anchors, and uploads.

---

## What was built

### Database & backup

| Item | Path |
|------|------|
| Migration | `supabase/migrations/20260815190000_raster_maps.sql` |
| Table | `raster_maps` (grid bounds, rows/columns, geo anchors, default flag) |
| Storage bucket | `raster-maps` (public read, auth write) |
| Seed row | `jaarbeurs-2026` with Jaarbeurs 2026 anchors |
| Full DB backup script | `scripts/backup-database.mjs` → `pnpm backup:db` |
| Restore script | `scripts/restore-database.mjs` → `pnpm restore:db` |

**Note:** Migration was applied to the remote project during development (`supabase db push`). If you check out `main` locally, the app still runs (falls back to bundled PNG + default anchors), but admin map CRUD needs the table.

Pre-migration backup (if still on disk): `backups/full-2026-08-15T17-40-19-335Z-pre-raster-maps/` (gitignored).

### App — Sitrep

| Item | Path |
|------|------|
| Raster / Kaart toggle | `app/components/sitrep/SitrepMap.vue` |
| OSM + overlay + markers | `app/components/sitrep/SitrepGeoMap.vue` |
| Bilinear geo projection | `app/utils/rasterMapProjection.ts` |
| Runtime map fetch | `app/utils/rasterMapApi.ts` |
| Fallback defaults | `app/constants/defaultRasterMap.ts` |
| Config loads default map | `app/utils/supabaseApi.ts` (`apiVersion: 6`) |

**localStorage keys:**

- `sitrep-map-mode` — `raster` | `geo`
- `sitrep-map-geo-orientation` — `north` | `raster`

### App — Admin

| Item | Path |
|------|------|
| Map list | `app/pages/admin/maps/index.vue` |
| Grid + geo editor + OSM preview | `app/pages/admin/maps/[id].vue` |
| CRUD composable | `app/composables/useAdminRasterMaps.ts` |
| Nav tab | `app/components/admin/AdminNavTabs.vue` |

### Dependencies

- `leaflet`, `@types/leaflet`
- `leaflet-imageoverlay-rotated` — PNG overlay from 3 corner lat/lng
- `leaflet-rotate` — rotate OSM tiles to match raster orientation

Type shims: `app/types/leaflet-imageoverlay-rotated.d.ts`, `app/types/leaflet-rotate.d.ts`

---

## Geo anchors (Jaarbeurs seed)

Cell-corner semantics; bilinear extrapolation to full PNG corners.

| Corner | Sector | lat | lng |
|--------|--------|-----|-----|
| NW | B2 | 52.082375 | 5.105138 |
| NE | B21 | 52.085127 | 5.099418 |
| SW | J2 | 52.083854 | 5.107128 |
| SE | J21 | 52.087619 | 5.103799 |

Image top edge geographic bearing ≈ **302°** (not north-up).

---

## Known issues (why this is parked)

### 1. Map rotation is fragile

`leaflet-rotate` must **not** set bearing before the map is sized and `fitBounds` has run. Current flow:

1. Init map north-up (`bearing: 0`)
2. `fitToAnchors()` → reset bearing → fit → `applyMapBearing()`
3. After `invalidateSize()`, apply bearing again

**Symptoms when broken:** blank gray map, tiles translated off-screen, console error in `fitToAnchors` / `initMap`.

**Still unreliable:**

- Toggling **Raster ↔ Kaart** or resizing the panel may need extra `invalidateSize()` + re-fit.
- `fitBounds` with `leaflet-rotate` is not officially supported; we reset to 0° before fitting.
- Raster orientation toggle may not perfectly match the PNG raster view — alignment needs visual QA.

### 2. Possible double-init race (partially fixed)

`SitrepGeoMap` had concurrent `initMap()` calls from `onMounted` and `watch(mapEl)`. Guarded with `mapInitializing`, but worth retesting after ClientOnly mount cycles.

### 3. Admin geo preview lacks rotation

`/admin/maps/[id]` OSM preview does not use `leaflet-rotate` or the Noord/Raster toggle. Preview re-inits the whole map on anchor edits (debounced 400 ms) — slow but functional.

### 4. Incident form not fully wired

`RasterMapDialog.vue` uses runtime `rasterMap` config. `IncidentForm.vue` may still assume static grid only — verify if form sector picker should follow DB map config.

### 5. Production / GitHub Pages

- OSM tiles load from `tile.openstreetmap.org` (external dependency, usage policy).
- Leaflet chunk is large (~700 kB) — consider lazy-loading only on Kaart mode (partially done via dynamic imports for plugins).
- Remote Supabase must have migration applied for admin features; bundled fallback works for sitrep read-only.

---

## How to resume work

```bash
git checkout feat/openstreetmap
pnpm install
pnpm dev
# open http://localhost:3000/sitrep → Kaart tab → Kaart mode
```

### Apply migration (if needed)

```bash
supabase db push
# or run supabase/migrations/20260815190000_raster_maps.sql in dashboard
```

### Suggested next steps

1. **Stabilize init lifecycle** — single init path, `ResizeObserver` on map container, refit on panel resize.
2. **Validate alignment** — compare sector markers on Raster vs Kaart (both Noord and Raster orientation) at B2, J21, center cells.
3. **Improve rotation** — consider computing bearing from anchors and using `map.setBearing` only after `moveend` from fit; or drop `leaflet-rotate` and accept north-up OSM with rotated overlay only (`leaflet-imageoverlay-rotated` already handles skew).
4. **Admin preview parity** — share map init logic between `SitrepGeoMap.vue` and admin `[id].vue` (extract composable e.g. `useRasterGeoMap`).
5. **Tests** — unit tests for `imageFractionToLatLng`, `sectorToLatLng`, `imageTopEdgeBearing` with seed anchors.
6. **Merge checklist** — migration on prod, backup taken, visual QA on mobile, OSM tile policy OK for event.

---

## Key files (quick index)

```
app/components/sitrep/SitrepGeoMap.vue    # OSM map component
app/components/sitrep/SitrepMap.vue       # Raster | Kaart shell
app/utils/rasterMapProjection.ts        # Geo math
app/constants/defaultRasterMap.ts         # Fallback anchors
app/pages/admin/maps/                     # Admin UI
supabase/migrations/20260815190000_raster_maps.sql
scripts/backup-database.mjs
scripts/restore-database.mjs
```

---

## Related docs

- [OPERATOR_GUIDE.md](./OPERATOR_GUIDE.md) — end-user sitrep workflow (does not yet mention Kaart mode)
