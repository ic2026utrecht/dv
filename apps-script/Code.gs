/**
 * IC2026 DV — Incident Sitrep Apps Script
 *
 * Install: open the linked Sheet → Extensions → Apps Script → paste all .gs files
 * Run once: setupCleanWorkbook()  OR  createCleanWorkbook()
 * Legacy workbook: migrateToRelationalSchema()
 * Optional: installOnFormSubmitTrigger()
 *
 * Sheet ID: 1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q
 */

var CONFIG = {
  SPREADSHEET_ID: '1O0H1ozAEeCEFRUBj_UPbLNw4eAq1CmbQAt3YKpE2A3Q', // legacy; overridden by Script Property or bound sheet
  RAW_SHEET_NAMES: ['Form Responses 1', 'Formulierreacties 1', 'Responses'],
  REFERENCE_SHEET: 'Reference',
  LOCATIONS_SHEET: 'Locations',
  INCIDENT_TYPES_SHEET: 'IncidentTypes',
  HELP_OPTIONS_SHEET: 'HelpOptions',
  INCIDENTS_SHEET: 'Incidents',
  INCIDENTS_VIEW_SHEET: 'Incidents_view',
  SITREP_SHEET: 'Sitrep',
  DEFAULT_DEPARTMENT: 'Dienstverlening',
  DEFAULT_STATUS: 'Open',
  INCIDENT_ID_PREFIX: 'INC-2026-',
  EVENT_NAME: 'IC2026 DV — Situation Report'
};

/**
 * One-shot setup: Reference + dimension tabs + Incidents + Sitrep + sync existing rows.
 */
function setupWorkbook() {
  var ss = getSpreadsheet_();
  buildReferenceSheet_(ss);
  ensureDimensionSheets_(ss);
  syncIncidentsFromResponses();
  buildIncidentsViewSheet_(ss);
  refreshIncidentsView_(ss);
  buildSitrepSheet_(ss);
  SpreadsheetApp.flush();
  Logger.log('setupWorkbook complete');
}

/**
 * Re-sync all Form Responses into Incidents (preserves ops edits by source_row).
 */
function syncIncidentsFromResponses() {
  var ss = getSpreadsheet_();
  var raw = findRawSheet_(ss);
  if (!raw) {
    throw new Error('Could not find Form Responses sheet. Rename it to "Form Responses 1" or update CONFIG.RAW_SHEET_NAMES.');
  }

  ensureDimensionSheets_(ss);

  var incidents = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!incidents) {
    incidents = buildIncidentsSheet_(ss);
  }

  var maps = buildLookupMaps_(ss);
  var existingBySource = loadIncidentsBySourceRow_(incidents);
  var rawData = raw.getDataRange().getValues();
  if (rawData.length < 2) {
    Logger.log('No response rows to sync');
    refreshIncidentsView_(ss);
    return;
  }

  var headers = rawData[0].map(function (h) {
    return String(h || '').trim();
  });
  var col = mapRawColumns_(headers);

  var outRows = [];
  var nextId = 1;

  Object.keys(existingBySource).forEach(function (key) {
    var num = parseIncidentSequence_(existingBySource[key].incident_id);
    if (num >= nextId) nextId = num + 1;
  });

  for (var r = 1; r < rawData.length; r++) {
    var row = rawData[r];
    var locationName = String(getCell_(row, col.location) || '').trim();
    var description = resolveDescription_(row, col, headers);
    if (!row[col.timestamp] && !locationName && !description) {
      continue;
    }

    var sourceRow = r + 1;
    var previous = existingBySource[sourceRow];
    var incidentId = previous
      ? previous.incident_id
      : CONFIG.INCIDENT_ID_PREFIX + pad3_(nextId++);

    var department = getCell_(row, col.department) || CONFIG.DEFAULT_DEPARTMENT;
    var sectorText = String(getCell_(row, col.sector) || '').trim();
    var sectorParts = parseSectorText_(sectorText);
    var incidentTypeRaw = String(
      firstNonEmptyFromCols_(row, col.incident_type_cols, col.incident_type) || ''
    ).trim();
    var incidentTypeName = primaryMultiValue_(incidentTypeRaw);
    var helpText = normalizeHelp_(
      firstNonEmptyFromCols_(row, col.help_cols, col.help_deployed)
    );
    var ambulance = getCell_(row, col.ambulance_called);
    if (String(ambulance).toLowerCase() === 'ja' && helpText.indexOf('112 gebeld') === -1) {
      helpText = helpText ? helpText + ', 112 gebeld' : '112 gebeld';
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

    outRows.push(buildIncidentRow_({
      incidentId: incidentId,
      timestamp: timestamp,
      department: department,
      locationId: resolveLocationIdByName_(locationName, maps.locationsByName),
      sectorRow: sectorParts.row,
      sectorColumn: sectorParts.column,
      sectorLabel: sectorParts.label,
      incidentTypeId: resolveIncidentTypeIdByName_(
        incidentTypeName,
        department,
        maps.typesByKey
      ),
      description: description,
      helpOptionIds: resolveHelpIdsByNames_(helpText, maps.helpByName),
      priority: priority,
      reporter: reporter,
      status: status,
      actionOwner: previous ? previous.action_owner : getCell_(row, col.action_owner),
      deadline: previous ? previous.deadline : getCell_(row, col.deadline),
      lastUpdate: previous ? previous.last_update : getCell_(row, col.last_update),
      updateNotes: previous ? previous.update_notes : getCell_(row, col.update_notes),
      closedBy: previous ? previous.closed_by : getCell_(row, col.closed_by),
      closureResult: previous ? previous.closure_result : getCell_(row, col.closure_result),
      freeField: getCell_(row, col.free_field),
      scenario: getCell_(row, col.scenario),
      flagEhbo: parseBoolCell_(getCell_(row, col.flag_ehbo)),
      flagBeveiliging: parseBoolCell_(getCell_(row, col.flag_beveiliging)),
      flagHcSafety: parseBoolCell_(getCell_(row, col.flag_hc_safety)),
      flagReiniging: parseBoolCell_(getCell_(row, col.flag_reiniging)),
      flagVeiligheid: parseBoolCell_(getCell_(row, col.flag_veiligheid)),
      sourceRow: sourceRow,
      latitude: '',
      longitude: ''
    }));
  }

  ensureUniqueIncidentIds_(outRows);

  if (incidents.getLastRow() > 1) {
    var clearRows = incidents.getLastRow() - 1;
    incidents.getRange(2, 1, clearRows, INCIDENT_HEADERS.length).clearContent();
  }
  if (outRows.length) {
    incidents.getRange(2, 1, outRows.length, INCIDENT_HEADERS.length).setValues(outRows);
    applyIncidentDerivedFormulas_(incidents, 2, outRows.length + 1);
  }

  applyIncidentsFormatting_(incidents);
  applyIncidentsStatusValidation_(incidents);
  refreshIncidentsView_(ss);
  Logger.log('Synced ' + outRows.length + ' incidents');
}

/**
 * Install installable onFormSubmit trigger (run once as sheet owner).
 */
function installOnFormSubmitTrigger() {
  var ss = getSpreadsheet_();
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
    free_field: findIndex(['vrije veld']),
    scenario: findIndex(['scenario']),
    flag_ehbo: findExactHeaderIndex_(headers, 'EHBO'),
    flag_beveiliging: findExactHeaderIndex_(headers, 'Beveiliging'),
    flag_hc_safety: findIndex(['afd. hc safety', 'hc safety']),
    flag_reiniging: findExactHeaderIndex_(headers, 'Reiniging'),
    flag_veiligheid: findExactHeaderIndex_(headers, 'Veiligheid'),
    persons_involved: findIndex(['aantal betrokken']),
    ambulance_called: findIndex(['112 gebeld?'])
  };
}

function findExactHeaderIndex_(headers, name) {
  var target = String(name || '').trim().toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').trim().toLowerCase() === target) {
      return i;
    }
  }
  return -1;
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

/** Numeric suffix only — do not strip digits from INC-2026- prefix (old bug used replace(/\D/g)). */
function parseIncidentSequence_(id) {
  var s = String(id || '').trim();
  if (!s) return 0;
  var suffix = s.indexOf(CONFIG.INCIDENT_ID_PREFIX) === 0
    ? s.slice(CONFIG.INCIDENT_ID_PREFIX.length)
    : s.split('-').pop();
  var num = parseInt(String(suffix || '').replace(/\D/g, ''), 10);
  if (isNaN(num) || num < 0) return 0;
  // Ignore IDs corrupted by the old all-digits parser (e.g. INC-2026-2026002).
  if (num > 999999) return 0;
  return num;
}

function loadIncidentsBySourceRow_(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var colCount = Math.max(sheet.getLastColumn(), INCIDENT_HEADERS.length);
  var data = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  for (var i = 0; i < data.length; i++) {
    var sourceRow = data[i][INCIDENT_COL.source_row];
    if (!sourceRow) continue;
    map[sourceRow] = {
      incident_id: data[i][INCIDENT_COL.incident_id],
      status: data[i][INCIDENT_COL.status],
      action_owner: data[i][INCIDENT_COL.action_owner],
      deadline: data[i][INCIDENT_COL.deadline],
      last_update: data[i][INCIDENT_COL.last_update],
      update_notes: data[i][INCIDENT_COL.update_notes],
      closed_by: data[i][INCIDENT_COL.closed_by],
      closure_result: data[i][INCIDENT_COL.closure_result]
    };
  }
  return map;
}

function ensureUniqueIncidentIds_(rows) {
  var seen = {};
  var maxNum = 0;
  rows.forEach(function (r) {
    var id = String(r[INCIDENT_COL.incident_id]);
    var num = parseIncidentSequence_(id);
    if (!isNaN(num) && num > maxNum) maxNum = num;
    if (seen[id]) {
      maxNum += 1;
      r[INCIDENT_COL.incident_id] = CONFIG.INCIDENT_ID_PREFIX + pad3_(maxNum);
    }
    seen[r[INCIDENT_COL.incident_id]] = true;
  });
}

function applyIncidentsFormatting_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1a365d')
    .setFontColor('#ffffff');
  sheet.getRange('A:A').setNumberFormat('@');
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
  applyIncidentsStatusValidation_(sheet);
  return sheet;
}

function slugId_(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultIncidentTypes_() {
  return [
    { id: 'parkeer-toegang-geblokkeerd', department: 'Parkeer', name: 'Toegang geblokkeerd' },
    { id: 'dienstverlening-brand-rook', department: 'Dienstverlening', name: 'Brand/ Rook' },
    { id: 'ehbo-medisch-ehbo', department: 'EHBO', name: 'Medisch EHBO' }
  ];
}

function defaultHelpOptions_() {
  var names = [
    'EHBO',
    'Beveiliging Jaarbeurs',
    'Afd. HC Safety gebeld',
    'Reiniging of installatie gebeld',
    '112 gebeld',
    '112 gebeld - critical'
  ];
  var allDepartments = ['Parkeer', 'Dienstverlening', 'EHBO'];
  return names.map(function (name) {
    return {
      id: slugId_('help-' + name),
      name: name,
      departments: allDepartments
    };
  });
}
