/**
 * IC2026 DV — Incident Sitrep Apps Script
 *
 * Install: open the linked Sheet → Extensions → Apps Script → paste all .gs files
 * Run once: setupWorkbook()
 * Optional: installOnFormSubmitTrigger()
 *
 * Sheet ID: 1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q
 */

var CONFIG = {
  SPREADSHEET_ID: '1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q',
  RAW_SHEET_NAMES: ['Form Responses 1', 'Formulierreacties 1', 'Responses'],
  REFERENCE_SHEET: 'Reference',
  INCIDENTS_SHEET: 'Incidents',
  SITREP_SHEET: 'Sitrep',
  DEFAULT_DEPARTMENT: 'Dienstverlening',
  DEFAULT_STATUS: 'Open',
  INCIDENT_ID_PREFIX: 'INC-2026-',
  EVENT_NAME: 'IC2026 DV — Situation Report'
};

var INCIDENT_HEADERS = [
  'incident_id',
  'timestamp',
  'department',
  'location',
  'sector',
  'incident_type',
  'description',
  'help_deployed',
  'priority',
  'reporter',
  'status',
  'action_owner',
  'deadline',
  'last_update',
  'update_notes',
  'closed_by',
  'closure_result',
  'is_open',
  'age_minutes',
  'priority_rank',
  'source_row'
];

/**
 * One-shot setup: Reference + Incidents + Sitrep + sync existing rows.
 */
function setupWorkbook() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  buildReferenceSheet_(ss);
  buildLocationsSheet_(ss);
  buildIncidentsSheet_(ss);
  syncIncidentsFromResponses();
  buildSitrepSheet_(ss);
  SpreadsheetApp.flush();
  Logger.log('setupWorkbook complete');
}

/**
 * Re-sync all Form Responses into Incidents (preserves ops edits by source_row).
 */
function syncIncidentsFromResponses() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var raw = findRawSheet_(ss);
  if (!raw) {
    throw new Error('Could not find Form Responses sheet. Rename it to "Form Responses 1" or update CONFIG.RAW_SHEET_NAMES.');
  }

  var incidents = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!incidents) {
    incidents = buildIncidentsSheet_(ss);
  }

  var existingBySource = loadIncidentsBySourceRow_(incidents);
  var rawData = raw.getDataRange().getValues();
  if (rawData.length < 2) {
    Logger.log('No response rows to sync');
    return;
  }

  var headers = rawData[0].map(function (h) {
    return String(h || '').trim();
  });
  var col = mapRawColumns_(headers);

  var outRows = [];
  var nextId = 1;

  // Resolve next ID from existing incidents first
  Object.keys(existingBySource).forEach(function (key) {
    var num = parseInt(String(existingBySource[key].incident_id).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num >= nextId) nextId = num + 1;
  });

  for (var r = 1; r < rawData.length; r++) {
    var row = rawData[r];
    var location = String(getCell_(row, col.location) || '').trim();
    var description = resolveDescription_(row, col, headers);
    if (!row[col.timestamp] && !location && !description) {
      continue;
    }

    var sourceRow = r + 1;
    var previous = existingBySource[sourceRow];
    var incidentId = previous
      ? previous.incident_id
      : CONFIG.INCIDENT_ID_PREFIX + pad3_(nextId++);

    var department = getCell_(row, col.department) || CONFIG.DEFAULT_DEPARTMENT;
    var sector = String(getCell_(row, col.sector) || '').trim();
    var incidentTypeRaw = String(
      firstNonEmptyFromCols_(row, col.incident_type_cols, col.incident_type) || ''
    ).trim();
    var incidentType = primaryMultiValue_(incidentTypeRaw);
    var helpDeployed = normalizeHelp_(
      firstNonEmptyFromCols_(row, col.help_cols, col.help_deployed)
    );
    var ambulance = getCell_(row, col.ambulance_called);
    if (String(ambulance).toLowerCase() === 'ja' && helpDeployed.indexOf('112 gebeld') === -1) {
      helpDeployed = helpDeployed ? helpDeployed + ', 112 gebeld' : '112 gebeld';
    }
    var persons = getCell_(row, col.persons_involved);
    if (persons !== '' && persons !== null && persons !== undefined) {
      description = description
        ? description + ' [betrokkenen: ' + persons + ']'
        : 'Betrokkenen: ' + persons;
    }
    var priority = normalizePriority_(getCell_(row, col.priority));
    var reporter = String(getCell_(row, col.reporter) || '').trim();
    var timestamp = row[col.timestamp];

    var status = previous
      ? previous.status
      : (getCell_(row, col.status) || CONFIG.DEFAULT_STATUS);
    if (!status) status = CONFIG.DEFAULT_STATUS;

    var actionOwner = previous
      ? previous.action_owner
      : getCell_(row, col.action_owner);
    var deadline = previous ? previous.deadline : getCell_(row, col.deadline);
    var lastUpdate = previous ? previous.last_update : getCell_(row, col.last_update);
    var updateNotes = previous ? previous.update_notes : getCell_(row, col.update_notes);
    var closedBy = previous ? previous.closed_by : getCell_(row, col.closed_by);
    var closureResult = previous
      ? previous.closure_result
      : getCell_(row, col.closure_result);

    var isOpen = String(status).trim().toLowerCase() !== 'afgesloten';
    var priorityRank = priorityToRank_(priority);
    var ageMinutes = '';

    outRows.push([
      incidentId,
      timestamp,
      department,
      location,
      sector,
      incidentType,
      description,
      helpDeployed,
      priority,
      reporter,
      status,
      actionOwner || '',
      deadline || '',
      lastUpdate || '',
      updateNotes || '',
      closedBy || '',
      closureResult || '',
      isOpen,
      ageMinutes,
      priorityRank,
      sourceRow
    ]);
  }

  // Renumber any new IDs that collided because previous map was empty
  ensureUniqueIncidentIds_(outRows);

  if (incidents.getLastRow() > 1) {
    incidents.getRange(2, 1, incidents.getLastRow(), INCIDENT_HEADERS.length).clearContent();
  }
  if (outRows.length) {
    incidents.getRange(2, 1, outRows.length, INCIDENT_HEADERS.length).setValues(outRows);
    applyIncidentDerivedFormulas_(incidents, outRows.length);
  }

  applyIncidentsFormatting_(incidents);
  Logger.log('Synced ' + outRows.length + ' incidents');
}

/**
 * Install installable onFormSubmit trigger (run once as sheet owner).
 */
function installOnFormSubmitTrigger() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'onFormSubmitSync') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onFormSubmitSync')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  Logger.log('onFormSubmitSync trigger installed');
}

/**
 * Trigger handler: sync after each form submission.
 */
function onFormSubmitSync(e) {
  syncIncidentsFromResponses();
}

function findRawSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < CONFIG.RAW_SHEET_NAMES.length; i++) {
    var name = CONFIG.RAW_SHEET_NAMES[i];
    var sh = ss.getSheetByName(name);
    if (sh) return sh;
  }
  // Fallback: first sheet whose header contains Tijdstempel
  for (var j = 0; j < sheets.length; j++) {
    var header = sheets[j].getRange(1, 1).getValue();
    if (String(header).toLowerCase().indexOf('tijdstempel') !== -1 ||
        String(header).toLowerCase().indexOf('timestamp') !== -1) {
      return sheets[j];
    }
  }
  return null;
}

function mapRawColumns_(headers) {
  function findIndex(patterns) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      for (var p = 0; p < patterns.length; p++) {
        if (h.indexOf(patterns[p]) !== -1) return i;
      }
    }
    return -1;
  }

  function findAll(patterns) {
    var idxs = [];
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      for (var p = 0; p < patterns.length; p++) {
        if (h.indexOf(patterns[p]) !== -1) {
          idxs.push(i);
          break;
        }
      }
    }
    return idxs;
  }

  return {
    timestamp: findIndex(['tijdstempel', 'timestamp']),
    department: findIndex(['afdeling', 'department']),
    location: findIndex(['locatie', 'location']),
    sector: findIndex(['sector']),
    incident_type: findIndex(['soort incident', 'incident type', 'incident_type']),
    incident_type_cols: findAll(['soort incident', 'incident type', 'incident_type']),
    description: findIndex(['korte omschrijving']),
    description_fallback: findIndex(['omschrijving', 'description']),
    help_deployed: findIndex(['directe hulp', 'hulp is uitgezet', 'help']),
    help_cols: findAll(['directe hulp', 'hulp is uitgezet']),
    priority: findIndex(['prioriteit', 'priority']),
    reporter: findIndex(['melder', 'reporter']),
    status: findIndex(['status']),
    action_owner: findIndex(['actiehouder', 'action_owner']),
    deadline: findIndex(['deadline']),
    last_update: findIndex(['laatste update', 'last_update']),
    update_notes: findIndex(['omschrijving update', 'update_notes']),
    closed_by: findIndex(['afgesloten door', 'closed_by']),
    closure_result: findIndex(['afsluiting', 'closure']),
    persons_involved: findIndex(['aantal betrokken']),
    ambulance_called: findIndex(['112 gebeld?'])
  };
}

function firstNonEmptyFromCols_(row, idxs, fallbackIdx) {
  if (idxs && idxs.length) {
    for (var i = 0; i < idxs.length; i++) {
      var v = getCell_(row, idxs[i]);
      if (v !== '' && v !== null && v !== undefined) return v;
    }
  }
  return getCell_(row, fallbackIdx);
}

function resolveDescription_(row, col, headers) {
  if (col.description >= 0) {
    return String(getCell_(row, col.description) || '').trim();
  }
  if (col.description_fallback >= 0) {
    var fh = String(headers[col.description_fallback] || '').toLowerCase();
    if (fh.indexOf('update') !== -1) return '';
    return String(getCell_(row, col.description_fallback) || '').trim();
  }
  return '';
}

function getCell_(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  var v = row[idx];
  if (v === null || v === undefined) return '';
  return v;
}

function primaryMultiValue_(value) {
  if (!value) return '';
  var parts = String(value).split(',').map(function (s) {
    return s.trim();
  }).filter(Boolean);
  return parts.length ? parts[0] : '';
}

function normalizeHelp_(value) {
  if (!value) return '';
  return String(value)
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s && s.toLowerCase().indexOf('critical') === -1;
    })
    .join(', ');
}

function normalizePriority_(value) {
  var v = String(value || '').trim();
  if (!v) return 'Middel';
  var lower = v.toLowerCase();
  if (lower === 'critical' || lower === 'kritiek') return 'Critical';
  if (lower === 'hoog' || lower === 'high') return 'Hoog';
  if (lower === 'middel' || lower === 'medium') return 'Middel';
  if (lower === 'laag' || lower === 'low') return 'Laag';
  return v;
}

function priorityToRank_(priority) {
  switch (String(priority)) {
    case 'Critical':
      return 1;
    case 'Hoog':
      return 2;
    case 'Middel':
      return 3;
    case 'Laag':
      return 4;
    default:
      return 9;
  }
}

function pad3_(n) {
  var s = String(n);
  while (s.length < 3) s = '0' + s;
  return s;
}

function loadIncidentsBySourceRow_(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var data = sheet.getRange(2, 1, lastRow, INCIDENT_HEADERS.length).getValues();
  for (var i = 0; i < data.length; i++) {
    var sourceRow = data[i][20];
    if (!sourceRow) continue;
    map[sourceRow] = {
      incident_id: data[i][0],
      status: data[i][10],
      action_owner: data[i][11],
      deadline: data[i][12],
      last_update: data[i][13],
      update_notes: data[i][14],
      closed_by: data[i][15],
      closure_result: data[i][16]
    };
  }
  return map;
}

function ensureUniqueIncidentIds_(rows) {
  var seen = {};
  var maxNum = 0;
  rows.forEach(function (r) {
    var id = String(r[0]);
    var num = parseInt(id.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
    if (seen[id]) {
      maxNum += 1;
      r[0] = CONFIG.INCIDENT_ID_PREFIX + pad3_(maxNum);
    }
    seen[r[0]] = true;
  });
}

function applyIncidentDerivedFormulas_(sheet, rowCount) {
  for (var i = 0; i < rowCount; i++) {
    var row = i + 2;
    // is_open
    sheet.getRange(row, 18).setFormula(
      '=IF(K' + row + '="";TRUE;LOWER(TRIM(K' + row + '))<>"afgesloten")'
    );
    // age_minutes
    sheet.getRange(row, 19).setFormula(
      '=IF(B' + row + '="";"";ROUND((NOW()-B' + row + ')*24*60,0))'
    );
    // priority_rank
    sheet.getRange(row, 20).setFormula(
      '=IFERROR(VLOOKUP(I' + row + ';Reference!$D$3:$E$6;2;FALSE);9)'
    );
  }
}

function applyIncidentsFormatting_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1a365d')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, Math.min(12, INCIDENT_HEADERS.length));
}

function buildIncidentsSheet_(ss) {
  var sheet = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.INCIDENTS_SHEET);
  } else {
    sheet.clear();
  }
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length).setValues([INCIDENT_HEADERS]);
  applyIncidentsFormatting_(sheet);

  // Data validation for status
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Open', 'In behandeling', 'Afgesloten'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('K2:K1000').setDataValidation(statusRule);

  return sheet;
}
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
  sheet.getRange(2, 7, locaties.length + 1, 7).setValues(locaties);

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
  sheet.getRange(2, 9, sectoren.length + 1, 10).setValues(sectoren);

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
  sheet.getRange(2, 12, parkTypes.length + 1, 12).setValues(parkTypes);

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
  sheet.getRange(2, 14, dvTypes.length + 1, 14).setValues(dvTypes);

  // --- Incident types EHBO (P) ---
  sheet.getRange('P1').setValue('Incidenttypen_EHBO').setFontWeight('bold');
  var ehboTypes = [
    ['Medisch urgent (112)'],
    ['Medisch EHBO'],
    ['Overdracht ziekenhuis'],
    ['Meerdere slachtoffers'],
    ['Overig medisch']
  ];
  sheet.getRange(2, 16, ehboTypes.length + 1, 16).setValues(ehboTypes);

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
  sheet.getRange(2, 18, hulp.length + 1, 19).setValues(hulp);

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
/**
 * Locations tab — relational list for form location dropdown.
 * Columns: id | name | zone | active
 */
function buildLocationsSheet_(ss) {
  var sheet = ss.getSheetByName('Locations');
  if (!sheet) {
    sheet = ss.insertSheet('Locations');
  } else {
    sheet.clear();
  }

  sheet.getRange('A1:D1').setValues([['id', 'name', 'zone', 'active']]);
  sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#2c5282').setFontColor('#ffffff');

  var locations = [
    ['loc-hal12', 'Hal 12 (NL)', 'hal', 'TRUE'],
    ['loc-hal11', 'Hal 11', 'hal', 'TRUE'],
    ['loc-hal10', 'Hal 10', 'hal', 'TRUE'],
    ['loc-hal3', 'Hal 3 (MIVA)', 'hal', 'TRUE'],
    ['loc-hal4', 'Hal 4', 'hal', 'TRUE'],
    ['loc-hal7', 'Hal 7 (Engels)', 'hal', 'TRUE'],
    ['loc-hal8', 'Hal 8 (Food)', 'hal', 'TRUE'],
    ['loc-hal9', 'Hal 9 (Pap)', 'hal', 'TRUE'],
    ['loc-hal2', 'Hal 2', 'hal', 'TRUE'],
    ['loc-sector-a', 'Openbare ruimte - Sector A', 'outdoor', 'TRUE'],
    ['loc-sector-b', 'Openbare ruimte - Sector B', 'outdoor', 'TRUE'],
    ['loc-sector-c', 'Openbare ruimte - Sector C', 'outdoor', 'TRUE'],
    ['loc-sector-d', 'Openbare ruimte - Sector D', 'outdoor', 'TRUE'],
    ['loc-p4', 'P4', 'parking', 'TRUE'],
    ['loc-axa', 'AXA/Overig', 'other', 'TRUE'],
    ['loc-entree-zuid', 'Entree Zuid', 'entrance', 'TRUE'],
    ['loc-entree-west', 'Entree West', 'entrance', 'TRUE'],
    ['loc-entree-oost', 'Entree Oost', 'entrance', 'TRUE'],
    ['loc-verzamel-a', 'Verzamelplaats A (P3)', 'assembly', 'TRUE'],
    ['loc-verzamel-b', 'Verzamelplaats B (Hulpdiensten)', 'assembly', 'TRUE'],
    ['loc-verzamel-c', 'Verzamelplaats C (P2)', 'assembly', 'TRUE'],
    ['loc-verzamel-d', 'Verzamelplaats D (P1)', 'assembly', 'TRUE']
  ];

  sheet.getRange(2, 1, locations.length + 1, 4).setValues(locations);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);

  return sheet;
}
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
/**
 * REST API for the IC2026 incident web app (GitHub Pages).
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 *
 * GET  ?action=config  → reference data + locations
 * POST { incident }    → append row to Incidents
 */

var API_CONFIG = {
  LOCATIONS_SHEET: 'Locations',
  CORS_ORIGINS: ['*'] // tighten to https://ramonstaal.github.io in production if desired
};

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'config';
    if (action === 'config') {
      return jsonResponse_({ data: getIncidentConfig_() });
    }
    return jsonResponse_({ error: 'Unknown action' }, 400);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, 500);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var result = createIncidentFromWebApp_(body);
    return jsonResponse_({ data: result });
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, 400);
  }
}

function jsonResponse_(payload, status) {
  var output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script cannot set Access-Control-Allow-Origin on Web App responses.
  // Use Content-Type text/plain on client POST to avoid preflight, or deploy with redirect handling.
  return output;
}

function getIncidentConfig_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureWorkbookSheets_(ss);

  return {
    departments: [
      { value: 'Parkeer', label: 'Parkeer' },
      { value: 'Dienstverlening', label: 'Dienstverlening' },
      { value: 'EHBO', label: 'EHBO' }
    ],
    priorities: [
      { value: 'Critical', label: 'Critical' },
      { value: 'Hoog', label: 'Hoog' },
      { value: 'Middel', label: 'Middel' },
      { value: 'Laag', label: 'Laag' }
    ],
    locations: readLocations_(ss),
    incidentTypes: readIncidentTypes_(ss),
    helpOptions: readHelpOptions_(ss),
    raster: {
      rows: 'ABCDEFGHIJKLM'.split(''),
      columns: rangeInt_(1, 22)
    },
    personsCountOptions: rangeInt_(1, 10).map(function (n) {
      return { value: String(n), label: String(n) };
    })
  };
}

function createIncidentFromWebApp_(body) {
  validateSubmission_(body);

  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureWorkbookSheets_(ss);

  var locations = readLocations_(ss);
  var types = readIncidentTypes_(ss);
  var helpOptions = readHelpOptions_(ss);

  var location = locations.filter(function (l) {
    return l.id === body.locationId;
  })[0];
  if (!location) throw new Error('Onbekende locatie');

  var incidentType = types.filter(function (t) {
    return t.id === body.incidentTypeId;
  })[0];
  if (!incidentType) throw new Error('Onbekend incidenttype');
  if (incidentType.department !== body.department) {
    throw new Error('Incidenttype hoort niet bij geselecteerde afdeling');
  }

  var helpNames = (body.helpOptionIds || []).map(function (id) {
    var opt = helpOptions.filter(function (h) {
      return h.id === id;
    })[0];
    return opt ? opt.name : null;
  }).filter(Boolean);

  if (body.ambulanceCalled === true && helpNames.indexOf('112 gebeld') === -1) {
    helpNames.push('112 gebeld');
  }

  var sector = String(body.sectorRow) + String(body.sectorColumn);
  var description = String(body.description || '').trim();
  if (body.personsInvolved) {
    description += ' [betrokkenen: ' + body.personsInvolved + ']';
  }

  var incidents = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  var incidentId = nextIncidentId_(incidents);

  var row = [
    incidentId,
    new Date(),
    body.department,
    location.name,
    sector,
    incidentType.name,
    description,
    helpNames.join(', '),
    body.priority,
    String(body.reporter || '').trim(),
    CONFIG.DEFAULT_STATUS,
    '', '', '', '', '', '',
    true,
    '',
    priorityToRank_(body.priority),
    'webapp'
  ];

  incidents.appendRow(row);
  var newRow = incidents.getLastRow();
  applySingleIncidentFormulas_(incidents, newRow);

  return {
    incidentId: incidentId,
    timestamp: new Date().toISOString()
  };
}

function validateSubmission_(body) {
  var required = [
    'department', 'locationId', 'sectorRow', 'sectorColumn',
    'incidentTypeId', 'priority', 'reporter', 'description'
  ];
  required.forEach(function (key) {
    if (!body[key] && body[key] !== 0) {
      throw new Error('Verplicht veld ontbreekt: ' + key);
    }
  });
  if ('ABCDEFGHIJKLM'.indexOf(String(body.sectorRow)) === -1) {
    throw new Error('Ongeldige raster rij');
  }
  var col = Number(body.sectorColumn);
  if (isNaN(col) || col < 1 || col > 22) {
    throw new Error('Ongeldige raster kolom');
  }
  if (body.department === 'EHBO') {
    if (!body.personsInvolved) throw new Error('Aantal betrokkenen verplicht voor EHBO');
    if (body.ambulanceCalled === undefined || body.ambulanceCalled === null) {
      throw new Error('112 gebeld? verplicht voor EHBO');
    }
  }
}

function readLocations_(ss) {
  var sheet = ss.getSheetByName(API_CONFIG.LOCATIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow(), 4).getValues();
  return data.map(function (row) {
    return {
      id: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      zone: String(row[2] || '').trim(),
      active: row[3] === true || String(row[3]).toUpperCase() === 'TRUE'
    };
  }).filter(function (l) {
    return l.id && l.name;
  });
}

function readIncidentTypes_(ss) {
  var sheet = ss.getSheetByName(CONFIG.REFERENCE_SHEET);
  if (!sheet) return defaultIncidentTypes_();

  var types = [];
  types = types.concat(readTypeBlock_(sheet, 12, 'Parkeer'));
  types = types.concat(readTypeBlock_(sheet, 14, 'Dienstverlening'));
  types = types.concat(readTypeBlock_(sheet, 16, 'EHBO'));
  return types.length ? types : defaultIncidentTypes_();
}

function readTypeBlock_(sheet, col, department) {
  var lastRow = sheet.getLastRow();
  var out = [];
  for (var r = 2; r <= lastRow; r++) {
    var name = String(sheet.getRange(r, col).getValue() || '').trim();
    if (!name) continue;
    out.push({
      id: slugId_(department + '-' + name),
      department: department,
      name: name
    });
  }
  return out;
}

function readHelpOptions_(ss) {
  var sheet = ss.getSheetByName(CONFIG.REFERENCE_SHEET);
  var defaults = defaultHelpOptions_();
  if (!sheet) return defaults;

  var lastRow = sheet.getLastRow();
  var out = [];
  for (var r = 2; r <= lastRow; r++) {
    var name = String(sheet.getRange(r, 18).getValue() || '').trim();
    var depts = String(sheet.getRange(r, 19).getValue() || '').trim();
    if (!name) continue;
    out.push({
      id: slugId_('help-' + name),
      name: name,
      departments: depts
        ? depts.split(',').map(function (d) { return d.trim(); })
        : ['Parkeer', 'Dienstverlening', 'EHBO']
    });
  }
  return out.length ? out : defaults;
}

function defaultIncidentTypes_() {
  return [
    { id: 'parkeer-toegang', department: 'Parkeer', name: 'Toegang geblokkeerd' },
    { id: 'dv-brand', department: 'Dienstverlening', name: 'Brand/ Rook' },
    { id: 'ehbo-medisch', department: 'EHBO', name: 'Medisch EHBO' }
  ];
}

function defaultHelpOptions_() {
  var names = [
    'EHBO', 'Beveiliging Jaarbeurs', '112 gebeld',
    'Afd. HC Safety gebeld', 'Reiniging of installatie gebeld'
  ];
  return names.map(function (name) {
    return {
      id: slugId_('help-' + name),
      name: name,
      departments: name === 'EHBO'
        ? ['EHBO']
        : ['Parkeer', 'Dienstverlening', 'EHBO']
    };
  });
}

function slugId_(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function rangeInt_(start, end) {
  var arr = [];
  for (var i = start; i <= end; i++) arr.push(i);
  return arr;
}

function ensureWorkbookSheets_(ss) {
  if (!ss.getSheetByName(CONFIG.REFERENCE_SHEET)) buildReferenceSheet_(ss);
  if (!ss.getSheetByName(API_CONFIG.LOCATIONS_SHEET)) buildLocationsSheet_(ss);
  if (!ss.getSheetByName(CONFIG.INCIDENTS_SHEET)) buildIncidentsSheet_(ss);
}

function applySingleIncidentFormulas_(sheet, row) {
  sheet.getRange(row, 18).setFormula(
    '=IF(K' + row + '="";TRUE;LOWER(TRIM(K' + row + '))<>"afgesloten")'
  );
  sheet.getRange(row, 19).setFormula(
    '=IF(B' + row + '="";"";ROUND((NOW()-B' + row + ')*24*60,0))'
  );
  sheet.getRange(row, 20).setFormula(
    '=IFERROR(VLOOKUP(I' + row + ';Reference!$D$3:$E$6;2;FALSE);9)'
  );
}

function nextIncidentId_(incidentsSheet) {
  var lastRow = incidentsSheet.getLastRow();
  var maxNum = 0;
  if (lastRow >= 2) {
    var ids = incidentsSheet.getRange(2, 1, lastRow, 1).getValues();
    ids.forEach(function (row) {
      var num = parseInt(String(row[0]).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
  }
  return CONFIG.INCIDENT_ID_PREFIX + pad3_(maxNum + 1);
}

function applyIncidentDerivedFormulas_(sheet, startRow, endRow) {
  for (var row = startRow; row <= endRow; row++) {
    applySingleIncidentFormulas_(sheet, row);
  }
}
