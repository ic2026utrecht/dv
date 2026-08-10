/**
 * Builds the Sitrep dashboard tab with KPIs and open-incident QUERY tables.
 * Reads human-readable rows from Incidents_view (joined dimension data).
 */
function buildSitrepSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SITREP_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SITREP_SHEET);
  } else {
    sheet.clear();
  }

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

  sheet.getRange('A5').setValue('KPI').setFontWeight('bold');
  sheet.getRange('B5').setValue('Waarde').setFontWeight('bold');
  sheet.getRange('A5:B5').setBackground('#1a365d').setFontColor('#ffffff');

  var kpis = [
    ['Totaal meldingen', '=COUNTA(Incidents_view!A2:A)'],
    ['Open', '=COUNTIF(Incidents_view!P2:P;TRUE)'],
    ['Afgesloten', '=COUNTIF(Incidents_view!P2:P;FALSE)'],
    ['Critical open', '=COUNTIFS(Incidents_view!J2:J;"Critical";Incidents_view!P2:P;TRUE)'],
    ['Hoog open', '=COUNTIFS(Incidents_view!J2:J;"Hoog";Incidents_view!P2:P;TRUE)'],
    ['Open — Parkeer', '=COUNTIFS(Incidents_view!C2:C;"Parkeer";Incidents_view!P2:P;TRUE)'],
    ['Open — Dienstverlening', '=COUNTIFS(Incidents_view!C2:C;"Dienstverlening";Incidents_view!P2:P;TRUE)'],
    ['Open — EHBO', '=COUNTIFS(Incidents_view!C2:C;"EHBO";Incidents_view!P2:P;TRUE)']
  ];
  sheet.getRange(6, 1, kpis.length, 2).setValues(kpis);

  sheet.getRange('D5').setValue('Prioriteit (alle)').setFontWeight('bold');
  sheet.getRange('E5').setValue('Aantal').setFontWeight('bold');
  sheet.getRange('D5:E5').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.getRange('D6:E9').setValues([
    ['Critical', '=COUNTIF(Incidents_view!J2:J;"Critical")'],
    ['Hoog', '=COUNTIF(Incidents_view!J2:J;"Hoog")'],
    ['Middel', '=COUNTIF(Incidents_view!J2:J;"Middel")'],
    ['Laag', '=COUNTIF(Incidents_view!J2:J;"Laag")']
  ]);

  sheet.getRange('A16').setValue('CRITICAL & HOOG — open').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A16').setBackground('#9b2c2c').setFontColor('#ffffff');
  sheet.getRange('A17').setFormula(
    '=IFERROR(QUERY(Incidents_view!A2:O;' +
      '"select A, B, C, D, E, F, G, J, M, N ' +
      'where M <> \'Afgesloten\' and M is not null and (J = \'Critical\' or J = \'Hoog\') ' +
      'order by J, B desc";1);"Geen Critical/Hoog open")'
  );

  sheet.getRange('A30').setValue('ALLE OPEN INCIDENTEN').setFontWeight('bold').setFontSize(12);
  sheet.getRange('A30').setBackground('#2b6cb0').setFontColor('#ffffff');
  sheet.getRange('A31').setFormula(
    '=IFERROR(QUERY(Incidents_view!A2:O;' +
      '"select A, B, C, D, E, F, G, J, M, N ' +
      'where M <> \'Afgesloten\' and M is not null ' +
      'order by J, B desc";1);"Geen open incidenten")'
  );

  sheet.getRange('G5').setValue('Per zone (open)').setFontWeight('bold');
  sheet.getRange('G5').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.getRange('G6').setFormula(
    '=IFERROR(QUERY(Incidents_view!A2:P;"select E, count(A) where P = true group by E label count(A) \'Open\'";1);"")'
  );

  sheet.getRange('G5').setNote('Zone komt uit Locations via Incidents_view');

  sheet.getRange('G12').setValue('Periode-filter (info)').setFontWeight('bold');
  sheet.getRange('G12').setBackground('#1a365d').setFontColor('#ffffff');
  sheet.getRange('G13').setValue('Meldingen in periode');
  sheet.getRange('H13').setFormula(
    '=IF(B3="Alles";COUNTA(Incidents_view!A2:A);' +
      'IF(B3="Vandaag";COUNTIFS(Incidents_view!B2:B;">="&TODAY();Incidents_view!B2:B;"<"&TODAY()+1);' +
      'COUNTIFS(Incidents_view!B2:B;">="&NOW()-TIME(1;0;0))))'
  );
  sheet.getRange('G14').setValue('Open in periode');
  sheet.getRange('H14').setFormula(
    '=IF(B3="Alles";COUNTIF(Incidents_view!P2:P;TRUE);' +
      'IF(B3="Vandaag";COUNTIFS(Incidents_view!B2:B;">="&TODAY();Incidents_view!B2:B;"<"&TODAY()+1;Incidents_view!P2:P;TRUE);' +
      'COUNTIFS(Incidents_view!B2:B;">="&NOW()-TIME(1;0;0);Incidents_view!P2:P;TRUE)))'
  );

  sheet.getRange('A50').setValue(
    'Ops: bewerk status / actiehouder / deadline op tabblad Incidents (kolommen M–S). Incidents_view is alleen-lezen.'
  );
  sheet.getRange('A50').setFontStyle('italic');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 160);
  for (var c = 3; c <= 12; c++) {
    sheet.setColumnWidth(c, 120);
  }

  return sheet;
}

function refreshSitrep() {
  var ss = getSpreadsheet_();
  refreshIncidentsView_(ss);
  buildSitrepSheet_(ss);
}
