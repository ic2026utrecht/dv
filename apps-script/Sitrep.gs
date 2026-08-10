/**
 * Builds the Sitrep dashboard tab with KPIs and open-incident QUERY tables.
 */
function buildSitrepSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SITREP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SITREP_SHEET);
  } else {
    sheet.clear();
  }

  // Title / controls
  sheet.getRange('A1').setValue(CONFIG.EVENT_NAME).setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2').setValue('Gegenereerd:');
  sheet.getRange('B2').setFormula('=NOW()');
  sheet.getRange('B2').setNumberFormat('dd-mm-yyyy hh:mm');

  sheet.getRange('A3').setValue('Periode:');
  sheet.getRange('B3').setValue('Alles');
  var periodRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Alles', 'Vandaag', 'Laatste 60 min'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('B3').setDataValidation(periodRule);
  sheet.getRange('C3').setValue('← wijzig filter; tab herrekent automatisch');

  // KPI headers
  sheet.getRange('A5').setValue('KPI').setFontWeight('bold');
  sheet.getRange('B5').setValue('Waarde').setFontWeight('bold');
  sheet.getRange('A5:B5').setBackground('#1a365d').setFontColor('#ffffff');

  var kpis = [
    ['Totaal meldingen', '=COUNTA(Incidents!A2:A)'],
    ['Open', '=COUNTIF(Incidents!R2:R;TRUE)'],
    ['Afgesloten', '=COUNTIF(Incidents!R2:R;FALSE)'],
    ['Critical open', '=COUNTIFS(Incidents!I2:I;"Critical";Incidents!R2:R;TRUE)'],
    ['Hoog open', '=COUNTIFS(Incidents!I2:I;"Hoog";Incidents!R2:R;TRUE)'],
    ['Open — Parkeer', '=COUNTIFS(Incidents!C2:C;"Parkeer";Incidents!R2:R;TRUE)'],
    ['Open — Dienstverlening', '=COUNTIFS(Incidents!C2:C;"Dienstverlening";Incidents!R2:R;TRUE)'],
    ['Open — EHBO', '=COUNTIFS(Incidents!C2:C;"EHBO";Incidents!R2:R;TRUE)']
  ];
  sheet.getRange(6, 1, kpis.length, 2).setValues(kpis);

  // Priority breakdown
  sheet.getRange('D5').setValue('Prioriteit (alle)').setFontWeight('bold');
  sheet.getRange('E5').setValue('Aantal').setFontWeight('bold');
  sheet.getRange('D5:E5').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.getRange('D6:E9').setValues([
    ['Critical', '=COUNTIF(Incidents!I2:I;"Critical")'],
    ['Hoog', '=COUNTIF(Incidents!I2:I;"Hoog")'],
    ['Middel', '=COUNTIF(Incidents!I2:I;"Middel")'],
    ['Laag', '=COUNTIF(Incidents!I2:I;"Laag")']
  ]);

  // Critical / Hoog open highlight
  sheet.getRange('A16').setValue('CRITICAL & HOOG — open').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A16').setBackground('#9b2c2c').setFontColor('#ffffff');
  sheet.getRange('A17').setFormula(
    '=IFERROR(QUERY(Incidents!A2:Q;' +
      '"select A, B, C, D, E, F, G, I, K, L ' +
      'where K <> \'Afgesloten\' and K is not null and (I = \'Critical\' or I = \'Hoog\') ' +
      'order by I, B desc";1);"Geen Critical/Hoog open")'
  );

  // All open incidents
  sheet.getRange('A30').setValue('ALLE OPEN INCIDENTEN').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A30').setBackground('#2b6cb0').setFontColor('#ffffff');
  sheet.getRange('A31').setFormula(
    '=IFERROR(QUERY(Incidents!A2:Q;' +
      '"select A, B, C, D, E, F, G, I, K, L ' +
      'where K <> \'Afgesloten\' and K is not null ' +
      'order by I, B desc";1);"Geen open incidenten")'
  );

  // Period-aware note (simple helper counts using B3)
  sheet.getRange('G5').setValue('Periode-filter (info)').setFontWeight('bold');
  sheet.getRange('G5').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.getRange('G6').setValue('Meldingen in periode');
  sheet.getRange('H6').setFormula(
    '=IF(B3="Alles";COUNTA(Incidents!A2:A);' +
      'IF(B3="Vandaag";COUNTIFS(Incidents!B2:B;">="&TODAY();Incidents!B2:B;"<"&TODAY()+1);' +
      'COUNTIFS(Incidents!B2:B;">="&NOW()-TIME(1;0;0))))'
  );
  sheet.getRange('G7').setValue('Open in periode');
  sheet.getRange('H7').setFormula(
    '=IF(B3="Alles";COUNTIF(Incidents!R2:R;TRUE);' +
      'IF(B3="Vandaag";COUNTIFS(Incidents!B2:B;">="&TODAY();Incidents!B2:B;"<"&TODAY()+1;Incidents!R2:R;TRUE);' +
      'COUNTIFS(Incidents!B2:B;">="&NOW()-TIME(1;0;0);Incidents!R2:R;TRUE)))'
  );

  // Ops reminder
  sheet.getRange('A50').setValue(
    'Ops: bewerk status / actiehouder / deadline op tabblad Incidents (kolommen K–Q). Form Responses blijft archief.'
  );
  sheet.getRange('A50').setFontStyle('italic');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 160);
  for (var c = 3; c <= 12; c++) {
    sheet.setColumnWidth(c, 120);
  }

  return sheet;
}

/**
 * Manual refresh helper — re-applies Sitrep layout (keeps Incidents data).
 */
function refreshSitrep() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  buildSitrepSheet_(ss);
}
