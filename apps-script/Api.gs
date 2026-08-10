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
  var callback = e && e.parameter && e.parameter.callback;
  try {
    var action = (e && e.parameter && e.parameter.action) || 'config';

    if (action === 'config') {
      return respond_(callback, { data: getIncidentConfig_() });
    }
    return respond_(callback, { error: 'Unknown action' });
  } catch (err) {
    return respond_(callback, { error: String(err.message || err) });
  }
}

/**
 * JSON for direct browser navigation; JSONP for cross-origin fetch from the web app.
 */
function respond_(callback, payload) {
  var json = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_(payload);
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
  ensureIncidentGeoColumns_(ss);
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
    'webapp',
    formatCoord_(body.latitude),
    formatCoord_(body.longitude)
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
  validateOptionalCoord_(body.latitude, -90, 90, 'latitude');
  validateOptionalCoord_(body.longitude, -180, 180, 'longitude');
}

function validateOptionalCoord_(value, min, max, label) {
  if (value === undefined || value === null || value === '') return;
  var n = Number(value);
  if (isNaN(n) || n < min || n > max) {
    throw new Error('Ongeldige ' + label);
  }
}

function formatCoord_(value) {
  if (value === undefined || value === null || value === '') return '';
  var n = Number(value);
  return isNaN(n) ? '' : n;
}

function readLocations_(ss) {
  var sheet = ss.getSheetByName(API_CONFIG.LOCATIONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var numRows = sheet.getLastRow() - 1;
  var data = sheet.getRange(2, 1, numRows, 4).getValues();
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
  ensureIncidentGeoColumns_(ss);
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
    var ids = incidentsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
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
