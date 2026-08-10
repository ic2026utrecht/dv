/**
 * Workbook access + clean-slate setup.
 *
 * Clean slate (recommended):
 *   createCleanWorkbook()     → new Sheet in Drive, all tabs, empty Incidents
 *
 * Or open a blank Sheet you created, paste scripts, run:
 *   setupCleanWorkbook()
 */

function getSpreadsheetId_() {
  var prop = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (prop) {
    return prop;
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active.getId();
  }
  return CONFIG.SPREADSHEET_ID;
}

function getSpreadsheet_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

/**
 * Creates a brand-new Google Sheet in your Drive and builds all IC2026 tabs.
 * Run from Apps Script editor (any container). Check Executions log for the URL.
 */
function createCleanWorkbook() {
  var ss = SpreadsheetApp.create('IC2026 DV — Incidents');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  setupCleanWorkbookOn_(ss);
  Logger.log('Clean workbook created');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Open: ' + ss.getUrl());
  Logger.log('Next: Deploy → Manage deployments → Web app (New version)');
  return ss.getUrl();
}

/**
 * Builds all tabs on the active (or configured) spreadsheet — no Form Responses import.
 */
function setupCleanWorkbook() {
  var ss = getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  setupCleanWorkbookOn_(ss);
  Logger.log('setupCleanWorkbook complete');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Open: ' + ss.getUrl());
}

/**
 * Creates any missing tabs without wiping Incidents data.
 * Run this if setup ran with an incomplete Code.gs (missing tab names).
 */
function repairCleanWorkbook() {
  var ss = getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  if (!ss.getSheetByName(configSheet_('REFERENCE_SHEET', 'Reference'))) {
    buildReferenceSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('LOCATIONS_SHEET', 'Locations'))) {
    buildLocationsSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('INCIDENT_TYPES_SHEET', 'IncidentTypes'))) {
    buildIncidentTypesSheet_(ss);
  } else if (ss.getSheetByName(configSheet_('INCIDENT_TYPES_SHEET', 'IncidentTypes')).getLastRow() < 2) {
    buildIncidentTypesSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('HELP_OPTIONS_SHEET', 'HelpOptions'))) {
    buildHelpOptionsSheet_(ss);
  } else if (ss.getSheetByName(configSheet_('HELP_OPTIONS_SHEET', 'HelpOptions')).getLastRow() < 2) {
    buildHelpOptionsSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'))) {
    buildIncidentsSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('INCIDENTS_VIEW_SHEET', 'Incidents_view'))) {
    buildIncidentsViewSheet_(ss);
  }
  if (!ss.getSheetByName(configSheet_('SITREP_SHEET', 'Sitrep'))) {
    buildSitrepSheet_(ss);
  }

  refreshIncidentsView_(ss);
  fixIncidentsValidations();
  removeDefaultSheets_(ss);
  SpreadsheetApp.flush();

  Logger.log('repairCleanWorkbook complete');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Open: ' + ss.getUrl());
  Logger.log('Run auditWorkbook() to verify all tabs.');
}

function setupCleanWorkbookOn_(ss) {
  buildReferenceSheet_(ss);
  buildLocationsSheet_(ss);
  buildIncidentTypesSheet_(ss);
  buildHelpOptionsSheet_(ss);
  buildIncidentsSheet_(ss);
  buildIncidentsViewSheet_(ss);
  refreshIncidentsView_(ss);
  buildSitrepSheet_(ss);
  removeDefaultSheets_(ss);
  SpreadsheetApp.flush();
}

function removeDefaultSheets_(ss) {
  var keep = [
    CONFIG.REFERENCE_SHEET || 'Reference',
    CONFIG.LOCATIONS_SHEET || 'Locations',
    CONFIG.INCIDENT_TYPES_SHEET || 'IncidentTypes',
    CONFIG.HELP_OPTIONS_SHEET || 'HelpOptions',
    CONFIG.INCIDENTS_SHEET || 'Incidents',
    CONFIG.INCIDENTS_VIEW_SHEET || 'Incidents_view',
    CONFIG.SITREP_SHEET || 'Sitrep'
  ];
  if (ss.getSheets().length <= 1) {
    return;
  }
  ss.getSheets().forEach(function (sheet) {
    if (keep.indexOf(sheet.getName()) === -1 && sheet.getLastRow() <= 1 && sheet.getLastColumn() <= 1) {
      ss.deleteSheet(sheet);
    }
  });
}
