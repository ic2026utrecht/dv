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
      { value: 'Laag', label: 'Laag' },
      { value: 'Middel', label: 'Middel' },
      { value: 'Hoog', label: 'Hoog' },
      { value: 'Critical', label: 'Critical' }
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

  var location = null;
  if (body.locationId) {
    location = locations.filter(function (l) {
      return l.id === body.locationId;
    })[0];
    if (!location) throw new Error('Onbekende locatie');
  }

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
    'department', 'incidentTypeId', 'priority', 'description'
  ];
  required.forEach(function (key) {
    if (!body[key] && body[key] !== 0) {
      throw new Error('Verplicht veld ontbreekt: ' + key);
    }
  });

  var hasLocation = Boolean(body.locationId);
  var hasSector = Boolean(body.sectorRow) && body.sectorColumn !== undefined && body.sectorColumn !== null && body.sectorColumn !== '';
  if (!hasLocation && !hasSector) {
    throw new Error('Locatie of raster sector is verplicht');
  }

  if (hasSector) {
    if ('ABCDEFGHIJKLM'.indexOf(String(body.sectorRow)) === -1) {
      throw new Error('Ongeldige raster rij');
    }
    var col = Number(body.sectorColumn);
    if (isNaN(col) || col < 1 || col > 22) {
      throw new Error('Ongeldige raster kolom');
    }
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
  ensureIncidentSchema_(ss);
  var rowNum = findIncidentRowById_(sheet, body.incidentId);
  if (!rowNum) {
    throw new Error('Incident niet gevonden: ' + body.incidentId);
  }

  if (body.timestamp !== undefined && body.timestamp !== null && body.timestamp !== '') {
    sheet.getRange(rowNum, INCIDENT_COL.timestamp + 1).setValue(parseApiInputDate_(body.timestamp));
  }
  if (body.department !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.department + 1).setValue(String(body.department || ''));
  }
  if (body.locationId !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.location_id + 1).setValue(String(body.locationId || ''));
  }
  if (body.sectorRow !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.sector_row + 1).setValue(String(body.sectorRow || ''));
  }
  if (body.sectorColumn !== undefined) {
    var sectorColumn = body.sectorColumn;
    sheet.getRange(rowNum, INCIDENT_COL.sector_column + 1).setValue(
      sectorColumn !== '' && sectorColumn !== null ? Number(sectorColumn) : ''
    );
  }
  if (body.sectorLabel !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.sector_label + 1).setValue(String(body.sectorLabel || ''));
  }
  if (body.incidentTypeId !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.incident_type_id + 1).setValue(String(body.incidentTypeId || ''));
  }
  if (body.description !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.description + 1).setValue(String(body.description || ''));
  }
  if (body.helpOptionIds !== undefined) {
    var helpIds = body.helpOptionIds;
    if (Array.isArray(helpIds)) {
      helpIds = helpIds.join(',');
    }
    sheet.getRange(rowNum, INCIDENT_COL.help_option_ids + 1).setValue(String(helpIds || ''));
  }
  if (body.priority !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.priority + 1).setValue(normalizePriority_(body.priority));
  }
  if (body.reporter !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.reporter + 1).setValue(String(body.reporter || ''));
  }
  if (body.freeField !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.free_field + 1).setValue(String(body.freeField || ''));
  }
  if (body.scenario !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.scenario + 1).setValue(String(body.scenario || ''));
  }
  setOptionalBoolColumn_(sheet, rowNum, INCIDENT_COL.flag_ehbo, body.flagEhbo);
  setOptionalBoolColumn_(sheet, rowNum, INCIDENT_COL.flag_beveiliging, body.flagBeveiliging);
  setOptionalBoolColumn_(sheet, rowNum, INCIDENT_COL.flag_hc_safety, body.flagHcSafety);
  setOptionalBoolColumn_(sheet, rowNum, INCIDENT_COL.flag_reiniging, body.flagReiniging);
  setOptionalBoolColumn_(sheet, rowNum, INCIDENT_COL.flag_veiligheid, body.flagVeiligheid);

  sheet.getRange(rowNum, INCIDENT_COL.status + 1).setValue(status);
  sheet.getRange(rowNum, INCIDENT_COL.last_update + 1).setValue(new Date());

  if (body.actionOwner !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.action_owner + 1).setValue(String(body.actionOwner || ''));
  }
  if (body.deadline !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.deadline + 1).setValue(
      body.deadline ? parseApiInputDate_(body.deadline) : ''
    );
  }
  if (body.updateNotes !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.update_notes + 1).setValue(String(body.updateNotes || ''));
  }
  if (body.closedBy !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.closed_by + 1).setValue(String(body.closedBy || ''));
  }
  if (body.closureResult !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.closure_result + 1).setValue(String(body.closureResult || ''));
  }
  if (body.latitude !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.latitude + 1).setValue(formatCoord_(body.latitude));
  }
  if (body.longitude !== undefined) {
    sheet.getRange(rowNum, INCIDENT_COL.longitude + 1).setValue(formatCoord_(body.longitude));
  }

  applySingleIncidentFormulas_(sheet, rowNum);
  refreshIncidentsView_(ss);

  return {
    incidentId: body.incidentId,
    status: status,
    updatedAt: new Date().toISOString()
  };
}

function setOptionalBoolColumn_(sheet, rowNum, colIndex, value) {
  if (value === undefined) {
    return;
  }
  sheet.getRange(rowNum, colIndex + 1).setValue(value === true);
}

function parseApiInputDate_(value) {
  if (value instanceof Date) {
    return value;
  }
  var parsed = new Date(String(value));
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return String(value || '');
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
  var incidents = ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'));
  if (!incidents || incidents.getLastRow() < 2) {
    return [];
  }

  ensureIncidentSchema_(ss);
  var maps = buildLookupMaps_(ss);
  var colCount = Math.max(incidents.getLastColumn(), INCIDENT_HEADERS.length);
  var data = incidents.getRange(2, 1, incidents.getLastRow() - 1, colCount).getValues();

  return data.map(function (row) {
    return mapIncidentRowToApiObject_(row, maps);
  }).filter(function (item) {
    return item.incidentId;
  });
}

function mapIncidentRowToApiObject_(row, maps) {
  var location = maps.locationNameById[row[INCIDENT_COL.location_id]] || {};
  var type = maps.typeNameById[row[INCIDENT_COL.incident_type_id]] || {};
  var locationName = location.name || String(row[INCIDENT_COL.location_id] || '');
  if (String(locationName).indexOf('unmatched:') === 0) {
    locationName = locationName.replace(/^unmatched:/, '').replace(/-/g, ' ');
  }
  var typeName = type.name || String(row[INCIDENT_COL.incident_type_id] || '');
  if (String(typeName).indexOf('unmatched:') === 0) {
    typeName = typeName.replace(/^unmatched:/, '').replace(/-/g, ' ');
  }

  var helpIdsRaw = String(row[INCIDENT_COL.help_option_ids] || '');
  var helpOptionIds = helpIdsRaw
    ? helpIdsRaw.split(',').map(function (part) { return part.trim(); }).filter(Boolean)
    : [];

  var sectorColumn = row[INCIDENT_COL.sector_column];
  var parsedSectorColumn = sectorColumn !== '' && sectorColumn !== null && sectorColumn !== undefined
    ? Number(sectorColumn)
    : null;

  return {
    incidentId: String(row[INCIDENT_COL.incident_id] || ''),
    timestamp: formatApiTimestamp_(row[INCIDENT_COL.timestamp]),
    department: String(row[INCIDENT_COL.department] || ''),
    locationId: String(row[INCIDENT_COL.location_id] || ''),
    locationName: locationName,
    zone: location.zone || '',
    sectorRow: String(row[INCIDENT_COL.sector_row] || ''),
    sectorColumn: parsedSectorColumn !== null && !isNaN(parsedSectorColumn) ? parsedSectorColumn : null,
    sectorLabel: String(row[INCIDENT_COL.sector_label] || ''),
    sector: formatSectorDisplay_(
      row[INCIDENT_COL.sector_row],
      row[INCIDENT_COL.sector_column],
      row[INCIDENT_COL.sector_label]
    ),
    incidentTypeId: String(row[INCIDENT_COL.incident_type_id] || ''),
    incidentTypeName: typeName,
    description: String(row[INCIDENT_COL.description] || ''),
    helpOptionIds: helpOptionIds,
    helpDeployed: helpNamesFromIds_(row[INCIDENT_COL.help_option_ids], maps.helpNameById),
    priority: String(row[INCIDENT_COL.priority] || ''),
    priorityRank: Number(row[INCIDENT_COL.priority_rank]) || 4,
    reporter: String(row[INCIDENT_COL.reporter] || ''),
    freeField: String(row[INCIDENT_COL.free_field] || ''),
    flagEhbo: parseBoolCell_(row[INCIDENT_COL.flag_ehbo]),
    flagBeveiliging: parseBoolCell_(row[INCIDENT_COL.flag_beveiliging]),
    flagHcSafety: parseBoolCell_(row[INCIDENT_COL.flag_hc_safety]),
    flagReiniging: parseBoolCell_(row[INCIDENT_COL.flag_reiniging]),
    flagVeiligheid: parseBoolCell_(row[INCIDENT_COL.flag_veiligheid]),
    status: String(row[INCIDENT_COL.status] || ''),
    actionOwner: String(row[INCIDENT_COL.action_owner] || ''),
    scenario: String(row[INCIDENT_COL.scenario] || ''),
    deadline: formatApiTimestamp_(row[INCIDENT_COL.deadline]),
    lastUpdate: formatApiTimestamp_(row[INCIDENT_COL.last_update]),
    updateNotes: String(row[INCIDENT_COL.update_notes] || ''),
    closedBy: String(row[INCIDENT_COL.closed_by] || ''),
    closureResult: String(row[INCIDENT_COL.closure_result] || ''),
    isOpen: row[INCIDENT_COL.is_open] === true || String(row[INCIDENT_COL.is_open]).toUpperCase() === 'TRUE',
    ageMinutes: Number(row[INCIDENT_COL.age_minutes]) || 0,
    sourceRow: String(row[INCIDENT_COL.source_row] || ''),
    latitude: formatCoord_(row[INCIDENT_COL.latitude]) || null,
    longitude: formatCoord_(row[INCIDENT_COL.longitude]) || null
  };
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
