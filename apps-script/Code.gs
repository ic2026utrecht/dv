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
