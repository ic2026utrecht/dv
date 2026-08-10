# Operator guide — IC2026 DV Sitrep

## Links

- **Webformulier:** https://ramonstaal.github.io/ic/
- **Workbook:** https://docs.google.com/spreadsheets/d/1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q/edit

## Roles

| Rol | Doet |
|-----|------|
| Melder (veld) | Vult het webformulier in |
| Ops / command post | Leest **Sitrep**, bewerkt **Incidents** |
| Beheerder | Beheert **Locations** / **Reference** tabs, Apps Script deploy |

---

## Melden (veldteam)

1. Open het webformulier (bookmark op telefoon).
2. Kies **Afdeling** (Parkeer / Dienstverlening / EHBO).
3. Kies **Locatie** uit de lijst.
4. Kies **raster rij** (A–M) en **kolom** (1–22) — gebruik de rasterkaart link als hulp.
5. Kies prioriteit, incidenttype, en optioneel ingezette hulp.
6. Vul korte omschrijving en melder (naam + telefoon) in.
7. Verstuur — je krijgt een referentienummer (`INC-2026-xxx`).

---

## Ops: incident bijwerken

Werk op tabblad **Incidents**:

| Kolom | Gebruik |
|-------|---------|
| K `status` | `Open` → `In behandeling` → `Afgesloten` |
| L `action_owner` | Wie actie heeft |
| M `deadline` | Doeltijd |
| N `last_update` | Tijdstip laatste update |
| O `update_notes` | Korte voortgang |
| P `closed_by` | Wie afsloot |
| Q `closure_result` | Resultaat |

---

## Sitrep lezen

Open tabblad **Sitrep** in de Sheet. Critical/Hoog open meldingen staan bovenaan.

---

## Lijsten beheren (zonder app-deploy)

| Tab | Kolommen | Wijziging |
|-----|----------|-----------|
| **Locations** | id, name, zone, active | Nieuwe locatie toevoegen |
| **Reference** L/P/N | incident type per afdeling | Types aanpassen |
| **Reference** R/S | hulp + afdelingen | Hulpopties per afdeling |

Raster A–M × 1–22 is vast in de app (zie `public/raster-map.png`).

---

## Storingen

| Symptoom | Actie |
|----------|--------|
| Formulier laadt niet | Check GitHub Pages deploy |
| Configuratie laden mislukt | Check Apps Script deploy + `NUXT_PUBLIC_SHEETS_API_URL` |
| Submit faalt | Apps Script logs → Executions |
| Locatie ontbreekt | Voeg rij toe op **Locations** tab |

