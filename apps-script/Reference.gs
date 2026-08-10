/**
 * Builds / refreshes the Reference lookup tab.
 */
function buildReferenceSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.REFERENCE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.REFERENCE_SHEET);
  } else {
    sheet.clear();
  }

  // --- Afdelingen (A1:A4) ---
  sheet.getRange('A1').setValue('Afdelingen').setFontWeight('bold');
  sheet.getRange('A2:A4').setValues([
    ['Parkeer'],
    ['Dienstverlening'],
    ['EHBO']
  ]);

  // --- Status (B1:B4) ---
  sheet.getRange('B1').setValue('Status').setFontWeight('bold');
  sheet.getRange('B2:B4').setValues([
    ['Open'],
    ['In behandeling'],
    ['Afgesloten']
  ]);

  // --- Prioriteit + rank (D1:E6) ---
  sheet.getRange('D1').setValue('Prioriteit').setFontWeight('bold');
  sheet.getRange('E1').setValue('Rank').setFontWeight('bold');
  sheet.getRange('D2:E2').setValues([['Prioriteit', 'Rank']]);
  sheet.getRange('D3:E6').setValues([
    ['Critical', 1],
    ['Hoog', 2],
    ['Middel', 3],
    ['Laag', 4]
  ]);

  // --- Locaties (G1:G16) ---
  sheet.getRange('G1').setValue('Locaties').setFontWeight('bold');
  var locaties = [
    ['Hal 12 (NL)'],
    ['Hal 11'],
    ['Hal 10'],
    ['Hal 3 (MIVA)'],
    ['Hal 4'],
    ['Hal 7 (Engels)'],
    ['Hal 8 (Food)'],
    ['Hal 9 (Pap)'],
    ['Hal 2'],
    ['Openbare ruimte - Sector A'],
    ['Openbare ruimte - Sector B'],
    ['Openbare ruimte - Sector C'],
    ['Openbare ruimte - Sector D'],
    ['P4'],
    ['AXA/Overig']
  ];
  sheet.getRange(2, 7, locaties.length, 1).setValues(locaties);

  // --- Sectoren per locatie (I1:J…) ---
  sheet.getRange('I1').setValue('Locatie').setFontWeight('bold');
  sheet.getRange('J1').setValue('Sector').setFontWeight('bold');
  var sectoren = [
    ['Hal 12 (NL)', 'B12'],
    ['Hal 12 (NL)', '1J5'],
    ['Hal 12 (NL)', 'Algemeen'],
    ['Hal 11', 'Algemeen'],
    ['Hal 10', 'Algemeen'],
    ['Hal 3 (MIVA)', 'Algemeen'],
    ['Hal 4', 'Algemeen'],
    ['Hal 4', 'Q8'],
    ['Hal 7 (Engels)', 'Algemeen'],
    ['Hal 8 (Food)', 'Algemeen'],
    ['Hal 9 (Pap)', 'H3'],
    ['Hal 9 (Pap)', 'Algemeen'],
    ['Hal 2', 'Algemeen'],
    ['Openbare ruimte - Sector A', 'Sector A'],
    ['Openbare ruimte - Sector B', 'Sector B'],
    ['Openbare ruimte - Sector C', 'Sector C'],
    ['Openbare ruimte - Sector D', 'Sector D'],
    ['P4', 'Parkeervak entree'],
    ['P4', 'P4 algemeen'],
    ['AXA/Overig', 'Overig']
  ];
  sheet.getRange(2, 9, sectoren.length, 2).setValues(sectoren);

  // --- Incident types Parkeer (L) ---
  sheet.getRange('L1').setValue('Incidenttypen_Parkeer').setFontWeight('bold');
  var parkTypes = [
    ['Toegang geblokkeerd'],
    ['Capaciteit vol'],
    ['Bewegwijzering'],
    ['Bemanning'],
    ['Materieel'],
    ['Overig']
  ];
  sheet.getRange(2, 12, parkTypes.length, 1).setValues(parkTypes);

  // --- Incident types DV (N) ---
  sheet.getRange('N1').setValue('Incidenttypen_DV').setFontWeight('bold');
  var dvTypes = [
    ['Medisch - Urgent, 112 gebeld'],
    ['Medisch - EHBO'],
    ['Beveiliging - ordeverstoorder/ gewelddadig persoon'],
    ['Brand/ Rook'],
    ['Andersdenkende - <2 personen'],
    ['Andersdenkende - >2 personen'],
    ['Demonstratie (binnen of buiten)'],
    ['Overlast door .... (niet-medisch)'],
    ['Vermist persoon (niet-medisch)'],
    ['Diefstal'],
    ['Technisch (niet-medisch)'],
    ['Niet-Medisch Algemeen']
  ];
  sheet.getRange(2, 14, dvTypes.length, 1).setValues(dvTypes);

  // --- Incident types EHBO (P) ---
  sheet.getRange('P1').setValue('Incidenttypen_EHBO').setFontWeight('bold');
  var ehboTypes = [
    ['Medisch urgent (112)'],
    ['Medisch EHBO'],
    ['Overdracht ziekenhuis'],
    ['Meerdere slachtoffers'],
    ['Overig medisch']
  ];
  sheet.getRange(2, 16, ehboTypes.length, 1).setValues(ehboTypes);

  // --- Hulp options (R:S) name + departments ---
  sheet.getRange('R1').setValue('Hulp_opties').setFontWeight('bold');
  sheet.getRange('S1').setValue('Afdelingen').setFontWeight('bold');
  var hulp = [
    ['EHBO', 'EHBO'],
    ['Beveiliging Jaarbeurs', 'Parkeer,Dienstverlening,EHBO'],
    ['112 gebeld', 'Parkeer,Dienstverlening,EHBO'],
    ['Afd. HC Safety gebeld', 'Parkeer,Dienstverlening,EHBO'],
    ['Reiniging of installatie gebeld', 'Parkeer,Dienstverlening']
  ];
  sheet.getRange(2, 18, hulp.length, 2).setValues(hulp);

  // --- Sitrep period options (T) ---
  sheet.getRange('T1').setValue('Sitrep_periode').setFontWeight('bold');
  sheet.getRange('T2:T4').setValues([
    ['Alles'],
    ['Vandaag'],
    ['Laatste 60 min']
  ]);

  sheet.getRange(1, 1, 1, 20)
    .setBackground('#2c5282')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 20);

  return sheet;
}
