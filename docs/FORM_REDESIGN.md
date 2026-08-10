# Form redesign — IC2026 DV Incidentenregistratie

Apply these changes in the Google Form editor (Forms UI). Apps Script cannot safely rewrite a live form without Forms API OAuth; this doc is the authoritative field list.

**Form:** https://docs.google.com/forms/d/e/1FAIpQLSdL5M1Q4GkvOEFjuCpVeJptri6yiab0l_v9r0vSVarrD6hZtw/viewform  
**Linked sheet:** keep the existing destination. New questions will append columns; do **not** reorder or delete columns A–H.

---

## 1. Form settings

| Setting | Value |
|---------|--------|
| Title | `IC2026 DV Incidentenregistratie` |
| Description | `Melding voor IC2026 DV — Parkeer, Dienstverlening, EHBO. Vul alle verplichte velden in. Status wordt later door ops bijgewerkt.` |
| Collect email | Optional (org accounts recommended) |
| Limit to 1 response | Off |

---

## 2. Section: Algemeen

Add a **section break** titled `Algemeen`. Put these questions first.

### Q1 — Afdeling *(new)*
- Type: **Dropdown**
- Required: **Yes**
- Options: `Parkeer` | `Dienstverlening` | `EHBO`
- After section: **Go to section based on answer**
  - Parkeer → Section Parkeer
  - Dienstverlening → Section Dienstverlening
  - EHBO → Section EHBO

### Q2 — Wat is de locatie?
- Type: Dropdown (keep)
- Required: Yes
- Options (update list):
  - Hal 12 (NL)
  - Hal 11
  - Hal 10
  - Hal 3 (MIVA)
  - Hal 4
  - Hal 7 (Engels)
  - Hal 8 (Food)
  - Hal 9 (Pap)
  - Hal 2
  - Openbare ruimte - Sector A
  - Openbare ruimte - Sector B
  - Openbare ruimte - Sector C
  - Openbare ruimte - Sector D
  - **P4** *(add)*
  - **AXA/Overig** *(add)*

### Q3 — Welke sector is het?
- Change type: **Dropdown** (was short answer)
- Required: **Yes**
- Options (starter — extend from Reference tab):
  - Algemeen
  - B12
  - 1J5
  - Q8
  - H3
  - Sector A
  - Sector B
  - Sector C
  - Sector D
  - Parkeervak entree
  - P4 algemeen
  - Overig

> Note: Forms cannot filter sector by location without Apps Script add-ons. Ops can tighten this list later; Sitrep still works.

### Q4 — Korte omschrijving
- Type: Short answer
- Required: **Yes**
- Description: `Typ in één zin wat er gebeurt…`

### Q5 — Wat is de prioriteit
- Type: Dropdown
- Required: **Yes**
- Options (order): `Critical` | `Hoog` | `Middel` | `Laag`

### Q6 — Wie is de melder?
- Type: Short answer
- Required: **Yes**
- Description: `Naam + telefoonnummer`

---

## 3. Section: Parkeer

Questions after Afdeling = Parkeer.

### Q7a — Welk soort incident? (Parkeer)
- Type: **Dropdown** (single select)
- Required: Yes
- Options:
  - Toegang geblokkeerd
  - Capaciteit vol
  - Bewegwijzering
  - Bemanning
  - Materieel
  - Overig

### Q8a — Welke directe hulp is uitgezet?
- Type: Checkboxes
- Required: No
- Options:
  - Beveiliging Jaarbeurs
  - Afd. HC Safety gebeld
  - Reiniging of installatie gebeld
  - 112 gebeld

Then: **Submit form** (end).

---

## 4. Section: Dienstverlening

### Q7b — Welk soort incident? (Dienstverlening)
- Type: **Dropdown** (single select — was multi-select)
- Required: Yes
- Options (same as today, one choice):
  - Medisch - Urgent, 112 gebeld
  - Medisch - EHBO
  - Beveiliging - ordeverstoorder/ gewelddadig persoon
  - Brand/ Rook
  - Andersdenkende - <2 personen
  - Andersdenkende - >2 personen
  - Demonstratie (binnen of buiten)
  - Overlast door .... (niet-medisch)
  - Vermist persoon (niet-medisch)
  - Diefstal
  - Technisch (niet-medisch)
  - Niet-Medisch Algemeen

### Q8b — Welke directe hulp is uitgezet?
- Type: Checkboxes
- Required: No
- Options (**remove** `112 gebeld - Critical`):
  - EHBO
  - Beveiliging Jaarbeurs
  - 112 gebeld
  - Afd. HC Safety gebeld
  - Reiniging of installatie gebeld

Then: **Submit form**.

---

## 5. Section: EHBO

### Q7c — Welk soort incident? (EHBO)
- Type: Dropdown
- Required: Yes
- Options:
  - Medisch urgent (112)
  - Medisch EHBO
  - Overdracht ziekenhuis
  - Meerdere slachtoffers
  - Overig medisch

### Q7c2 — Aantal betrokkenen
- Type: Short answer → Response validation: Number ≥ 1
- Required: Yes

### Q7c3 — 112 gebeld?
- Type: Multiple choice
- Required: Yes
- Options: `Ja` | `Nee`

### Q8c — Welke directe hulp is uitgezet?
- Type: Checkboxes
- Required: No
- Options:
  - EHBO
  - Beveiliging Jaarbeurs
  - 112 gebeld
  - Afd. HC Safety gebeld

Then: **Submit form**.

---

## 6. Column impact on Sheet

Existing columns A–H stay for historical responses.

After redesign, new submissions will typically append columns such as:

| Likely new header | Source |
|-------------------|--------|
| Afdeling | Q1 |
| Welk soort incident? (Parkeer) | Q7a |
| … (Dienstverlening) | Q7b |
| … (EHBO) | Q7c |
| Aantal betrokkenen | Q7c2 |
| 112 gebeld? | Q7c3 |

`syncIncidentsFromResponses()` maps by **header name** (contains `afdeling`, `locatie`, `sector`, etc.). After you change the form:

1. Submit one test response per department
2. Run `syncIncidentsFromResponses` from Apps Script
3. Confirm Incidents rows look correct

If a branched question creates a separate column, the sync uses the first matching header for incident type / help. If needed, rename headers so one primary incident-type column is clear, or extend `mapRawColumns_` in `Code.gs`.

---

## 7. Checklist

- [ ] Rename form title + description
- [ ] Add Afdeling with section branching
- [ ] Add P4 + AXA/Overig to locatie
- [ ] Convert sector to dropdown
- [ ] Make omschrijving, prioriteit, melder required
- [ ] Build Parkeer / Dienstverlening / EHBO sections
- [ ] Switch incident type to single-select
- [ ] Remove `112 gebeld - Critical` from hulp
- [ ] Do not delete or reorder old response columns
- [ ] Test 3 submissions → run sync → check Sitrep
