/**
 * REST API for the IC2026 incident web app (GitHub Pages).
 * Deploy: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone
 *
 * GET  ?action=config           → reference data + locations
 * GET  ?action=incidents        → all rows from Incidents_view (JSONP)
 * GET  ?action=update&payload=  → update incident ops fields (JSONP)
 * GET  ?action=submit&payload=  → append row (JSONP, used by browser)
 * POST { incident }             → append row (curl / server clients)
 */

var API_CONFIG = {
  LOCATIONS_SHEET: 'Locations',
  CORS_ORIGINS: ['*']
};

function doGet(e) {
  var callback = e && e.parameter && e.parameter.callback;
  try {
    var action = (e && e.parameter && e.parameter.action) || 'config';

    if (action === 'config') {
      return respond_(callback, { data: getIncidentConfig_() });
    }
    if (action === 'incidents') {
      var ss = getSpreadsheet_();
      ensureWorkbookSheets_(ss);
      return respond_(callback, { data: readIncidentsView_(ss) });
    }
    if (action === 'update' || action === 'updateIncident') {
      var updateRaw = (e && e.parameter && e.parameter.payload) || '{}';
      var updateBody = JSON.parse(updateRaw);
      var updateResult = updateIncidentFromWebApp_(updateBody);
      return respond_(callback, { data: updateResult });
    }
    if (action === 'submit') {
      var raw = (e && e.parameter && e.parameter.payload) || '{}';
      var body = JSON.parse(raw);
      var result = createIncidentFromWebApp_(body);
      return respond_(callback, { data: result });
    }
    return respond_(callback, { error: 'Unknown action' });
  } catch (err) {
    return respond_(callback, { error: String(err.message || err) });
  }
}

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
    if (body.incidentId && body.status) {
      var updateResult = updateIncidentFromWebApp_(body);
      return jsonResponse_({ data: updateResult });
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
  return output;
}

function getIncidentConfig_() {
  var ss = getSpreadsheet_();
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
    supportedActions: ['config', 'submit', 'incidents', 'update', 'updateIncident'],
    apiVersion: 2,
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

  var ss = getSpreadsheet_();
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

  var description = String(body.description || '').trim();
  if (body.personsInvolved) {
    description += ' [betrokkenen: ' + body.personsInvolved + ']';
  }

  var incidents = ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'));
  var incidentId = nextIncidentId_(incidents);

  var row = buildIncidentRow_({
    incidentId: incidentId,
    timestamp: new Date(),
    department: body.department,
    locationId: body.locationId,
    sectorRow: body.sectorRow,
    sectorColumn: body.sectorColumn,
    sectorLabel: '',
    incidentTypeId: body.incidentTypeId,
    description: description,
    helpOptionIds: resolveHelpIdsFromList_(
      body.helpOptionIds,
      helpOptions,
      body.ambulanceCalled
    ),
    priority: body.priority,
    reporter: String(body.reporter || '').trim(),
    status: CONFIG.DEFAULT_STATUS,
    sourceRow: 'webapp',
    latitude: formatCoord_(body.latitude),
    longitude: formatCoord_(body.longitude)
  });

  incidents.appendRow(row);
  var newRow = incidents.getLastRow();
  applySingleIncidentFormulas_(incidents, newRow);
  refreshIncidentsView_(ss);

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
    return l.id && l.name && l.active !== false;
  });
}

function readIncidentTypes_(ss) {
  var sheet = ss.getSheetByName(CONFIG.INCIDENT_TYPES_SHEET);
  if (sheet && sheet.getLastRow() >= 2) {
    var fromSheet = readIncidentTypesFromSheet_(sheet);
    if (fromSheet.length) {
      return fromSheet;
    }
  }

  var ref = ss.getSheetByName(CONFIG.REFERENCE_SHEET);
  if (!ref) return defaultIncidentTypes_();

  var types = [];
  types = types.concat(readTypeBlock_(ref, 12, 'Parkeer'));
  types = types.concat(readTypeBlock_(ref, 14, 'Dienstverlening'));
  types = types.concat(readTypeBlock_(ref, 16, 'EHBO'));
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
  var sheet = ss.getSheetByName(CONFIG.HELP_OPTIONS_SHEET);
  if (sheet && sheet.getLastRow() >= 2) {
    var fromSheet = readHelpOptionsFromSheet_(sheet);
    if (fromSheet.length) {
      return fromSheet;
    }
  }

  var ref = ss.getSheetByName(CONFIG.REFERENCE_SHEET);
  var defaults = defaultHelpOptions_();
  if (!ref) return defaults;

  var lastRow = ref.getLastRow();
  var out = [];
  for (var r = 2; r <= lastRow; r++) {
    var name = String(ref.getRange(r, 18).getValue() || '').trim();
    var depts = String(ref.getRange(r, 19).getValue() || '').trim();
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

function rangeInt_(start, end) {
  var arr = [];
  for (var i = start; i <= end; i++) arr.push(i);
  return arr;
}

function ensureWorkbookSheets_(ss) {
  if (!ss.getSheetByName(CONFIG.REFERENCE_SHEET)) buildReferenceSheet_(ss);
  ensureDimensionSheets_(ss);
  if (!ss.getSheetByName(CONFIG.INCIDENTS_VIEW_SHEET)) {
    buildIncidentsViewSheet_(ss);
  }
}

function updateIncidentFromWebApp_(body) {
  if (!body.incidentId) {
    throw new Error('incidentId verplicht');
  }
  if (!body.status) {
    throw new Error('status verplicht');
  }

  var status = normalizeStatus_(body.status);
  var allowed = ['Open', 'In behandeling', 'Afgesloten'];
  if (allowed.indexOf(status) === -1) {
    throw new Error('Ongeldige status');
  }

  var ss = getSpreadsheet_();
  ensureWorkbookSheets_(ss);
  var sheet = ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'));
  var rowNum = findIncidentRowById_(sheet, body.incidentId);
  if (!rowNum) {
    throw new Error('Incident niet gevonden: ' + body.incidentId);
  }

  sheet.getRange(rowNum, INCIDENT_COL.status + 1).setValue(status);
  sheet.getRange(rowNum, INCIDENT_COL.last_update + 1).setValue(new Date());

  if (body.actionOwner !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.action_owner + 1).setValue(String(body.actionOwner || ''));
  }
  if (body.updateNotes !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.update_notes + 1).setValue(String(body.updateNotes || ''));
  }
  if (status === 'Afgesloten') {
    if (body.closedBy) {
      sheet.getRange(rowNum, INCIDENT_COL.closed_by + 1).setValue(String(body.closedBy));
    }
    if (body.closureResult) {
      sheet.getRange(rowNum, INCIDENT_COL.closure_result + 1).setValue(String(body.closureResult));
    }
  }

  applySingleIncidentFormulas_(sheet, rowNum);
  refreshIncidentsView_(ss);

  return {
    incidentId: body.incidentId,
    status: status,
    updatedAt: new Date().toISOString()
  };
}

function findIncidentRowById_(sheet, incidentId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(incidentId)) {
      return i + 2;
    }
  }
  return 0;
}

function readIncidentsView_(ss) {
  refreshIncidentsView_(ss);
  var view = ss.getSheetByName(configSheet_('INCIDENTS_VIEW_SHEET', 'Incidents_view'));
  if (!view || view.getLastRow() < 2) {
    return [];
  }

  var data = view.getRange(2, 1, view.getLastRow() - 1, INCIDENTS_VIEW_HEADERS.length).getValues();
  return data.map(function (row) {
    return {
      incidentId: String(row[0] || ''),
      timestamp: formatApiTimestamp_(row[1]),
      department: String(row[2] || ''),
      locationName: String(row[3] || ''),
      zone: String(row[4] || ''),
      sector: String(row[5] || ''),
      incidentTypeName: String(row[6] || ''),
      description: String(row[7] || ''),
      helpDeployed: String(row[8] || ''),
      priority: String(row[9] || ''),
      priorityRank: Number(row[10]) || 4,
      reporter: String(row[11] || ''),
      status: String(row[12] || ''),
      actionOwner: String(row[13] || ''),
      deadline: formatApiTimestamp_(row[14]),
      isOpen: row[15] === true || String(row[15]).toUpperCase() === 'TRUE',
      ageMinutes: Number(row[16]) || 0,
      sourceRow: String(row[17] || ''),
      latitude: formatCoord_(row[18]) || null,
      longitude: formatCoord_(row[19]) || null
    };
  }).filter(function (item) {
    return item.incidentId;
  });
}

function formatApiTimestamp_(value) {
  if (!value && value !== 0) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function nextIncidentId_(incidentsSheet) {
  var lastRow = incidentsSheet.getLastRow();
  var maxNum = 0;
  if (lastRow >= 2) {
    var ids = incidentsSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function (row) {
      var num = parseIncidentSequence_(row[0]);
      if (num > maxNum) maxNum = num;
    });
  }
  return CONFIG.INCIDENT_ID_PREFIX + pad3_(maxNum + 1);
}
