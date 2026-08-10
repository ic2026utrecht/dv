/**
 * Relational schema — dimension tabs + Incidents foreign keys + Incidents_view.
 *
 * Run once on an existing workbook:
 *   migrateToRelationalSchema()
 *
 * Fresh install: setupWorkbook() (calls ensureDimensionSheets_ internally).
 */

var INCIDENT_HEADERS = [
  'incident_id',
  'timestamp',
  'department',
  'location_id',
  'sector_row',
  'sector_column',
  'sector_label',
  'incident_type_id',
  'description',
  'help_option_ids',
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
  'source_row',
  'latitude',
  'longitude'
];

var INCIDENT_COL = {
  incident_id: 0,
  timestamp: 1,
  department: 2,
  location_id: 3,
  sector_row: 4,
  sector_column: 5,
  sector_label: 6,
  incident_type_id: 7,
  description: 8,
  help_option_ids: 9,
  priority: 10,
  reporter: 11,
  status: 12,
  action_owner: 13,
  deadline: 14,
  last_update: 15,
  update_notes: 16,
  closed_by: 17,
  closure_result: 18,
  is_open: 19,
  age_minutes: 20,
  priority_rank: 21,
  source_row: 22,
  latitude: 23,
  longitude: 24
};

var INCIDENTS_VIEW_HEADERS = [
  'incident_id',
  'timestamp',
  'department',
  'location_name',
  'zone',
  'sector',
  'incident_type_name',
  'description',
  'help_deployed',
  'priority',
  'priority_rank',
  'reporter',
  'status',
  'action_owner',
  'deadline',
  'is_open',
  'age_minutes',
  'source_row',
  'latitude',
  'longitude'
];

/**
 * Clears stale status validation on column K (old schema) and applies it on column M.
 * Safe to run if migrateToRelationalSchema already migrated data but validation failed.
 */
function fixIncidentsValidations() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!sheet) {
    throw new Error('Incidents tab not found');
  }
  clearIncidentsValidations_(sheet);
  applyIncidentsStatusValidation_(sheet);
  SpreadsheetApp.flush();
  Logger.log('Incidents validation rules updated (status → column M)');
}

/**
 * Logs workbook health checks — run from Apps Script editor and view Executions log.
 */
function auditWorkbook() {
  var ss = getSpreadsheet_();
  var sheetNames = {
    incidents: CONFIG.INCIDENTS_SHEET || 'Incidents',
    incidentsView: CONFIG.INCIDENTS_VIEW_SHEET || 'Incidents_view',
    locations: CONFIG.LOCATIONS_SHEET || 'Locations',
    incidentTypes: CONFIG.INCIDENT_TYPES_SHEET || 'IncidentTypes',
    helpOptions: CONFIG.HELP_OPTIONS_SHEET || 'HelpOptions',
    reference: CONFIG.REFERENCE_SHEET || 'Reference',
    sitrep: CONFIG.SITREP_SHEET || 'Sitrep'
  };

  Logger.log('=== IC2026 workbook audit ===');
  Logger.log('Workbook: ' + ss.getName());
  Logger.log('ID: ' + ss.getId());
  Logger.log('URL: ' + ss.getUrl());

  Object.keys(sheetNames).forEach(function (key) {
    var name = sheetNames[key];
    Logger.log((ss.getSheetByName(name) ? 'OK' : 'MISSING') + ' tab: ' + name);
  });

  var configKeys = [
    'LOCATIONS_SHEET',
    'INCIDENT_TYPES_SHEET',
    'HELP_OPTIONS_SHEET',
    'INCIDENTS_VIEW_SHEET'
  ];
  var missingConfig = configKeys.filter(function (key) {
    return !CONFIG[key];
  });
  if (missingConfig.length) {
    Logger.log('WARN CONFIG missing: ' + missingConfig.join(', '));
    Logger.log('WARN Delete InstallAll.gs from this project if present — it overrides Code.gs');
  } else {
    Logger.log('OK CONFIG (all sheet names defined)');
  }

  var incidents = ss.getSheetByName(sheetNames.incidents);
  if (!incidents) {
    Logger.log('Run setupCleanWorkbook() to create all tabs, then audit again.');
    Logger.log('=== end audit ===');
    return;
  }

  var headers = readSheetHeaders_(incidents);
  var relational = headers.indexOf('location_id') >= 0;
  Logger.log(relational ? 'OK Incidents headers (relational)' : 'WARN Incidents still uses old headers');

  var rowCount = Math.max(incidents.getLastRow() - 1, 0);
  Logger.log('Incidents data rows: ' + rowCount);

  if (rowCount > 0 && relational) {
    var data = incidents.getRange(2, 1, rowCount, INCIDENT_HEADERS.length).getValues();
    data.forEach(function (row, i) {
      var issues = [];
      var locationId = String(row[INCIDENT_COL.location_id] || '');
      var typeId = String(row[INCIDENT_COL.incident_type_id] || '');
      var priority = String(row[INCIDENT_COL.priority] || '');
      var reporter = String(row[INCIDENT_COL.reporter] || '');

      if (locationId && locationId.indexOf('loc-') !== 0 && locationId.indexOf('unmatched:') !== 0) {
        issues.push('location_id looks like a name: ' + locationId);
      }
      if (typeId && typeId.indexOf('-') === -1 && typeId.indexOf('unmatched:') !== 0) {
        issues.push('incident_type_id suspicious: ' + typeId);
      }
      if (!priority) issues.push('missing priority');
      if (!reporter) issues.push('missing reporter');

      if (issues.length) {
        Logger.log('ROW ' + (i + 2) + ' ' + row[INCIDENT_COL.incident_id] + ': ' + issues.join('; '));
      }
    });
  }

  var view = ss.getSheetByName(sheetNames.incidentsView);
  if (view) {
    var viewHeaders = readSheetHeaders_(view);
    Logger.log(
      viewHeaders[0] === 'incident_id'
        ? 'OK Incidents_view headers'
        : 'WARN Incidents_view has wrong headers: ' + viewHeaders[0]
    );
    Logger.log('Incidents_view data rows: ' + Math.max(view.getLastRow() - 1, 0));
  }

  Logger.log('=== end audit ===');
}

/**
 * One-shot migration for live workbooks (preserves incident rows + ops edits).
 */
function migrateToRelationalSchema() {
  var ss = getSpreadsheet_();
  ensureDimensionSheets_(ss);
  migrateIncidentsSheetToRelational_(ss);
  buildIncidentsViewSheet_(ss);
  refreshIncidentsView_(ss);
  buildSitrepSheet_(ss);
  SpreadsheetApp.flush();
  Logger.log('migrateToRelationalSchema complete');
}

function ensureDimensionSheets_(ss) {
  if (!ss.getSheetByName(CONFIG.REFERENCE_SHEET)) {
    buildReferenceSheet_(ss);
  }
  if (!ss.getSheetByName(CONFIG.LOCATIONS_SHEET)) {
    buildLocationsSheet_(ss);
  }
  if (!ss.getSheetByName(CONFIG.INCIDENT_TYPES_SHEET)) {
    buildIncidentTypesSheet_(ss);
  }
  if (!ss.getSheetByName(CONFIG.HELP_OPTIONS_SHEET)) {
    buildHelpOptionsSheet_(ss);
  }
  if (!ss.getSheetByName(CONFIG.INCIDENTS_SHEET)) {
    buildIncidentsSheet_(ss);
  } else {
    ensureIncidentSchema_(ss);
  }
}

function ensureIncidentSchema_(ss) {
  var sheet = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 1) {
    return;
  }

  var headers = readSheetHeaders_(sheet);
  if (headers.indexOf('location_id') >= 0) {
    padIncidentHeaders_(sheet, headers);
    clearIncidentsValidations_(sheet);
    applyIncidentsStatusValidation_(sheet);
    return;
  }
}

function padIncidentHeaders_(sheet, headers) {
  if (headers.length >= INCIDENT_HEADERS.length) {
    return;
  }
  var missing = INCIDENT_HEADERS.slice(headers.length);
  sheet.getRange(1, headers.length + 1, 1, headers.length + missing.length)
    .setValues([missing]);
}

function migrateIncidentsSheetToRelational_(ss) {
  var sheet = ss.getSheetByName(CONFIG.INCIDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 1) {
    buildIncidentsSheet_(ss);
    return;
  }

  var headers = readSheetHeaders_(sheet);
  if (headers.indexOf('location_id') >= 0) {
    padIncidentHeaders_(sheet, headers);
    clearIncidentsValidations_(sheet);
    applyIncidentsStatusValidation_(sheet);
    return;
  }

  var maps = buildLookupMaps_(ss);
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), headers.length);
  var data = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
    : [];

  var oldIdx = indexHeaders_(headers);
  var newRows = data.map(function (row) {
    return migrateOldIncidentRow_(row, oldIdx, maps);
  });

  sheet.clear();
  clearIncidentsValidations_(sheet);
  sheet.getRange(1, 1, 1, INCIDENT_HEADERS.length).setValues([INCIDENT_HEADERS]);
  applyIncidentsFormatting_(sheet);

  if (newRows.length) {
    sheet.getRange(2, 1, newRows.length, INCIDENT_HEADERS.length).setValues(newRows);
    applyIncidentDerivedFormulas_(sheet, 2, newRows.length + 1);
  }

  applyIncidentsStatusValidation_(sheet);
  Logger.log('Migrated ' + newRows.length + ' incidents to relational schema');
}

function migrateOldIncidentRow_(row, oldIdx, maps) {
  var department = cellAt_(row, oldIdx.department);
  var locationName = cellAt_(row, oldIdx.location);
  var sectorText = cellAt_(row, oldIdx.sector);
  var incidentTypeName = cellAt_(row, oldIdx.incident_type);
  var helpText = cellAt_(row, oldIdx.help_deployed);
  var sectorParts = parseSectorText_(sectorText);

  var out = emptyIncidentRow_();
  out[INCIDENT_COL.incident_id] = cellAt_(row, oldIdx.incident_id);
  out[INCIDENT_COL.timestamp] = row[oldIdx.timestamp >= 0 ? oldIdx.timestamp : 0];
  out[INCIDENT_COL.department] = department || CONFIG.DEFAULT_DEPARTMENT;
  out[INCIDENT_COL.location_id] = resolveLocationIdByName_(locationName, maps.locationsByName);
  out[INCIDENT_COL.sector_row] = sectorParts.row;
  out[INCIDENT_COL.sector_column] = sectorParts.column;
  out[INCIDENT_COL.sector_label] = sectorParts.label;
  out[INCIDENT_COL.incident_type_id] = resolveIncidentTypeIdByName_(
    incidentTypeName,
    out[INCIDENT_COL.department],
    maps.typesByKey
  );
  out[INCIDENT_COL.description] = cellAt_(row, oldIdx.description);
  out[INCIDENT_COL.help_option_ids] = resolveHelpIdsByNames_(helpText, maps.helpByName);
  out[INCIDENT_COL.priority] = normalizePriority_(cellAt_(row, oldIdx.priority));
  out[INCIDENT_COL.reporter] = cellAt_(row, oldIdx.reporter);
  out[INCIDENT_COL.status] = normalizeStatus_(cellAt_(row, oldIdx.status));
  out[INCIDENT_COL.action_owner] = cellAt_(row, oldIdx.action_owner);
  out[INCIDENT_COL.deadline] = oldIdx.deadline >= 0 ? row[oldIdx.deadline] : '';
  out[INCIDENT_COL.last_update] = oldIdx.last_update >= 0 ? row[oldIdx.last_update] : '';
  out[INCIDENT_COL.update_notes] = cellAt_(row, oldIdx.update_notes);
  out[INCIDENT_COL.closed_by] = cellAt_(row, oldIdx.closed_by);
  out[INCIDENT_COL.closure_result] = cellAt_(row, oldIdx.closure_result);
  out[INCIDENT_COL.source_row] = oldIdx.source_row >= 0 ? row[oldIdx.source_row] : '';
  out[INCIDENT_COL.latitude] = oldIdx.latitude >= 0 ? row[oldIdx.latitude] : '';
  out[INCIDENT_COL.longitude] = oldIdx.longitude >= 0 ? row[oldIdx.longitude] : '';
  return out;
}

function indexHeaders_(headers) {
  function idx(name, aliases) {
    var names = [name].concat(aliases || []);
    for (var i = 0; i < headers.length; i++) {
      if (names.indexOf(headers[i]) >= 0) {
        return i;
      }
    }
    return -1;
  }

  return {
    incident_id: idx('incident_id'),
    timestamp: idx('timestamp'),
    department: idx('department'),
    location: idx('location'),
    sector: idx('sector'),
    incident_type: idx('incident_type'),
    description: idx('description'),
    help_deployed: idx('help_deployed'),
    priority: idx('priority'),
    reporter: idx('reporter'),
    status: idx('status'),
    action_owner: idx('action_owner'),
    deadline: idx('deadline'),
    last_update: idx('last_update'),
    update_notes: idx('update_notes'),
    closed_by: idx('closed_by'),
    closure_result: idx('closure_result'),
    source_row: idx('source_row'),
    latitude: idx('latitude'),
    longitude: idx('longitude')
  };
}

function emptyIncidentRow_() {
  var row = [];
  for (var i = 0; i < INCIDENT_HEADERS.length; i++) {
    row.push('');
  }
  return row;
}

function buildIncidentRow_(fields) {
  var row = emptyIncidentRow_();
  row[INCIDENT_COL.incident_id] = fields.incidentId;
  row[INCIDENT_COL.timestamp] = fields.timestamp;
  row[INCIDENT_COL.department] = fields.department;
  row[INCIDENT_COL.location_id] = fields.locationId;
  row[INCIDENT_COL.sector_row] = fields.sectorRow || '';
  row[INCIDENT_COL.sector_column] = fields.sectorColumn !== undefined && fields.sectorColumn !== null
    ? fields.sectorColumn
    : '';
  row[INCIDENT_COL.sector_label] = fields.sectorLabel || '';
  row[INCIDENT_COL.incident_type_id] = fields.incidentTypeId;
  row[INCIDENT_COL.description] = fields.description || '';
  row[INCIDENT_COL.help_option_ids] = fields.helpOptionIds || '';
  row[INCIDENT_COL.priority] = fields.priority;
  row[INCIDENT_COL.reporter] = fields.reporter || '';
  row[INCIDENT_COL.status] = fields.status || CONFIG.DEFAULT_STATUS;
  row[INCIDENT_COL.action_owner] = fields.actionOwner || '';
  row[INCIDENT_COL.deadline] = fields.deadline || '';
  row[INCIDENT_COL.last_update] = fields.lastUpdate || '';
  row[INCIDENT_COL.update_notes] = fields.updateNotes || '';
  row[INCIDENT_COL.closed_by] = fields.closedBy || '';
  row[INCIDENT_COL.closure_result] = fields.closureResult || '';
  row[INCIDENT_COL.source_row] = fields.sourceRow || '';
  row[INCIDENT_COL.latitude] = fields.latitude !== undefined ? fields.latitude : '';
  row[INCIDENT_COL.longitude] = fields.longitude !== undefined ? fields.longitude : '';
  return row;
}

function parseSectorText_(sector) {
  var s = String(sector || '').trim();
  if (!s) {
    return { row: '', column: '', label: '' };
  }
  var match = s.match(/^([A-Ma-m])(\d{1,2})$/);
  if (match) {
    return {
      row: match[1].toUpperCase(),
      column: Number(match[2]),
      label: ''
    };
  }
  return { row: '', column: '', label: s };
}

function formatSectorDisplay_(sectorRow, sectorColumn, sectorLabel) {
  if (sectorLabel) {
    return String(sectorLabel);
  }
  if (sectorRow && sectorColumn !== '' && sectorColumn !== null && sectorColumn !== undefined) {
    return String(sectorRow) + String(sectorColumn);
  }
  return '';
}

function buildLookupMaps_(ss) {
  var locations = readLocations_(ss);
  var types = readIncidentTypes_(ss);
  var helpOptions = readHelpOptions_(ss);

  var locationsByName = {};
  locations.forEach(function (loc) {
    locationsByName[normalizeKey_(loc.name)] = loc.id;
  });

  var typesByKey = {};
  types.forEach(function (type) {
    typesByKey[normalizeKey_(type.department + '|' + type.name)] = type.id;
    typesByKey[normalizeKey_(type.name)] = type.id;
  });

  var helpByName = {};
  helpOptions.forEach(function (opt) {
    helpByName[normalizeKey_(opt.name)] = opt.id;
  });

  return {
    locations: locations,
    locationsByName: locationsByName,
    types: types,
    typesByKey: typesByKey,
    helpOptions: helpOptions,
    helpByName: helpByName,
    locationNameById: mapById_(locations),
    typeNameById: mapById_(types),
    helpNameById: mapById_(helpOptions)
  };
}

function mapById_(items) {
  var map = {};
  items.forEach(function (item) {
    map[item.id] = item;
  });
  return map;
}

function normalizeKey_(value) {
  return String(value || '').trim().toLowerCase();
}

function cellAt_(row, idx) {
  if (idx < 0 || idx >= row.length) {
    return '';
  }
  var value = row[idx];
  if (value === null || value === undefined) {
    return '';
  }
  return value;
}

function resolveLocationIdByName_(name, locationsByName) {
  var key = normalizeKey_(name);
  if (!key) {
    return '';
  }
  if (locationsByName[key]) {
    return locationsByName[key];
  }
  return 'unmatched:' + slugId_(name);
}

function resolveIncidentTypeIdByName_(name, department, typesByKey) {
  var typeName = String(name || '').trim();
  if (!typeName) {
    return '';
  }
  var deptKey = normalizeKey_(department + '|' + typeName);
  if (typesByKey[deptKey]) {
    return typesByKey[deptKey];
  }
  var nameKey = normalizeKey_(typeName);
  if (typesByKey[nameKey]) {
    return typesByKey[nameKey];
  }
  return 'unmatched:' + slugId_(department + '-' + typeName);
}

function resolveHelpIdsByNames_(helpText, helpByName) {
  if (!helpText) {
    return '';
  }
  var ids = String(helpText)
    .split(',')
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean)
    .map(function (name) {
      var key = normalizeKey_(name);
      return helpByName[key] || ('unmatched:' + slugId_(name));
    });
  return ids.join(',');
}

function resolveHelpIdsFromList_(helpOptionIds, helpOptions, ambulanceCalled) {
  var ids = (helpOptionIds || []).slice();
  if (ambulanceCalled === true) {
    var help112 = helpOptions.filter(function (opt) {
      return normalizeKey_(opt.name) === normalizeKey_('112 gebeld');
    })[0];
    if (help112 && ids.indexOf(help112.id) === -1) {
      ids.push(help112.id);
    }
  }
  return ids.join(',');
}

function helpNamesFromIds_(idsCsv, helpNameById) {
  if (!idsCsv) {
    return '';
  }
  return String(idsCsv)
    .split(',')
    .map(function (id) {
      id = id.trim();
      if (!id) {
        return '';
      }
      if (helpNameById[id]) {
        return helpNameById[id].name;
      }
      if (id.indexOf('unmatched:') === 0) {
        return id.replace(/^unmatched:/, '').replace(/-/g, ' ');
      }
      return id;
    })
    .filter(Boolean)
    .join(', ');
}

function readSheetHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (header) {
      return String(header || '').trim();
    });
}

function configSheet_(key, fallback) {
  return (typeof CONFIG !== 'undefined' && CONFIG[key]) ? CONFIG[key] : fallback;
}

function buildIncidentTypesSheet_(ss) {
  var tabName = configSheet_('INCIDENT_TYPES_SHEET', 'IncidentTypes');
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, 4).setValues([['id', 'department', 'name', 'active']]);
  sheet.getRange(1, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#2c5282')
    .setFontColor('#ffffff');

  var rows = [];
  var ref = ss.getSheetByName(configSheet_('REFERENCE_SHEET', 'Reference'));
  if (ref) {
    rows = rows.concat(readTypeRowsFromReference_(ref, 12, 'Parkeer'));
    rows = rows.concat(readTypeRowsFromReference_(ref, 14, 'Dienstverlening'));
    rows = rows.concat(readTypeRowsFromReference_(ref, 16, 'EHBO'));
  }
  if (!rows.length) {
    defaultIncidentTypes_().forEach(function (type) {
      rows.push([type.id, type.department, type.name, 'TRUE']);
    });
  }

  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);
  return sheet;
}

function readTypeRowsFromReference_(sheet, col, department) {
  var out = [];
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    var name = String(sheet.getRange(r, col).getValue() || '').trim();
    if (!name) {
      continue;
    }
    out.push([slugId_(department + '-' + name), department, name, 'TRUE']);
  }
  return out;
}

function buildHelpOptionsSheet_(ss) {
  var tabName = configSheet_('HELP_OPTIONS_SHEET', 'HelpOptions');
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, 4).setValues([['id', 'name', 'departments', 'active']]);
  sheet.getRange(1, 1, 1, 4)
    .setFontWeight('bold')
    .setBackground('#2c5282')
    .setFontColor('#ffffff');

  var rows = [];
  var ref = ss.getSheetByName(configSheet_('REFERENCE_SHEET', 'Reference'));
  if (ref) {
    var lastRow = ref.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var name = String(ref.getRange(r, 18).getValue() || '').trim();
      var depts = String(ref.getRange(r, 19).getValue() || '').trim();
      if (!name) {
        continue;
      }
      rows.push([slugId_('help-' + name), name, depts || 'Parkeer,Dienstverlening,EHBO', 'TRUE']);
    }
  }
  if (!rows.length) {
    defaultHelpOptions_().forEach(function (opt) {
      rows.push([
        opt.id,
        opt.name,
        opt.departments.join(','),
        'TRUE'
      ]);
    });
  }

  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);
  return sheet;
}

function readIncidentTypesFromSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues().map(function (row) {
    return {
      id: String(row[0] || '').trim(),
      department: String(row[1] || '').trim(),
      name: String(row[2] || '').trim(),
      active: row[3] === true || String(row[3]).toUpperCase() === 'TRUE'
    };
  }).filter(function (type) {
    return type.id && type.name && type.active !== false;
  });
}

function readHelpOptionsFromSheet_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, 4).getValues().map(function (row) {
    var depts = String(row[2] || '').trim();
    return {
      id: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      departments: depts
        ? depts.split(',').map(function (d) { return d.trim(); })
        : ['Parkeer', 'Dienstverlening', 'EHBO'],
      active: row[3] === true || String(row[3]).toUpperCase() === 'TRUE'
    };
  }).filter(function (opt) {
    return opt.id && opt.name && opt.active !== false;
  });
}

function buildIncidentsViewSheet_(ss) {
  var tabName = configSheet_('INCIDENTS_VIEW_SHEET', 'Incidents_view');
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  } else {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, INCIDENTS_VIEW_HEADERS.length).setValues([INCIDENTS_VIEW_HEADERS]);
  sheet.getRange(1, 1, 1, INCIDENTS_VIEW_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1a365d')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.getRange('A2').setValue('Wordt gevuld door refreshIncidentsView()');
  sheet.getRange('A3').setFontStyle('italic');
  return sheet;
}

function refreshIncidentsView_(ss) {
  ss = ss || getSpreadsheet_();
  var incidents = ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'));
  var view = ss.getSheetByName(configSheet_('INCIDENTS_VIEW_SHEET', 'Incidents_view'));
  if (!incidents || !view) {
    return;
  }

  var maps = buildLookupMaps_(ss);
  var lastRow = incidents.getLastRow();
  if (lastRow < 2) {
    if (view.getLastRow() > 1) {
      view.getRange(2, 1, view.getLastRow() - 1, INCIDENTS_VIEW_HEADERS.length).clearContent();
    }
    return;
  }

  var data = incidents.getRange(2, 1, lastRow - 1, INCIDENT_HEADERS.length).getValues();
  var out = data.map(function (row) {
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

    return [
      row[INCIDENT_COL.incident_id],
      row[INCIDENT_COL.timestamp],
      row[INCIDENT_COL.department],
      locationName,
      location.zone || '',
      formatSectorDisplay_(
        row[INCIDENT_COL.sector_row],
        row[INCIDENT_COL.sector_column],
        row[INCIDENT_COL.sector_label]
      ),
      typeName,
      row[INCIDENT_COL.description],
      helpNamesFromIds_(row[INCIDENT_COL.help_option_ids], maps.helpNameById),
      row[INCIDENT_COL.priority],
      row[INCIDENT_COL.priority_rank],
      row[INCIDENT_COL.reporter],
      row[INCIDENT_COL.status],
      row[INCIDENT_COL.action_owner],
      row[INCIDENT_COL.deadline],
      row[INCIDENT_COL.is_open],
      row[INCIDENT_COL.age_minutes],
      row[INCIDENT_COL.source_row],
      row[INCIDENT_COL.latitude],
      row[INCIDENT_COL.longitude]
    ];
  });

  if (view.getLastRow() > 1) {
    view.getRange(2, 1, view.getLastRow() - 1, INCIDENTS_VIEW_HEADERS.length).clearContent();
  }
  view.getRange(2, 1, out.length, INCIDENTS_VIEW_HEADERS.length).setValues(out);
  view.autoResizeColumns(1, Math.min(12, INCIDENTS_VIEW_HEADERS.length));
}

function clearIncidentsValidations_(sheet) {
  var rows = Math.max(sheet.getMaxRows(), 500);
  var cols = Math.max(sheet.getMaxColumns(), INCIDENT_HEADERS.length);
  sheet.getRange(1, 1, rows, cols).clearDataValidations();
}

function normalizeStatus_(value) {
  var status = String(value || '').trim();
  if (!status) {
    return CONFIG.DEFAULT_STATUS;
  }
  var lower = status.toLowerCase();
  if (lower === 'open') return 'Open';
  if (lower === 'in behandeling') return 'In behandeling';
  if (lower === 'afgesloten') return 'Afgesloten';
  return status;
}

function applyIncidentsStatusValidation_(sheet) {
  clearIncidentsValidations_(sheet);
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Open', 'In behandeling', 'Afgesloten'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange('M2:M5000').setDataValidation(statusRule);
}

function applySingleIncidentFormulas_(sheet, row) {
  sheet.getRange(row, INCIDENT_COL.is_open + 1).setFormula(
    '=IF(M' + row + '="";TRUE;LOWER(TRIM(M' + row + '))<>"afgesloten")'
  );
  sheet.getRange(row, INCIDENT_COL.age_minutes + 1).setFormula(
    '=IF(B' + row + '="";"";ROUND((NOW()-B' + row + ')*24*60;0))'
  );
  sheet.getRange(row, INCIDENT_COL.priority_rank + 1).setFormula(
    '=IFERROR(VLOOKUP(K' + row + ';Reference!$D$3:$E$6;2;FALSE);9)'
  );
}

function applyIncidentDerivedFormulas_(sheet, startRow, endRow) {
  for (var row = startRow; row <= endRow; row++) {
    applySingleIncidentFormulas_(sheet, row);
  }
}
