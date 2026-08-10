/**
 * Seed test incidents directly in the Sheet (bypasses the web API).
 * Useful for Sitrep/ops testing with varied statuses and priorities.
 *
 * Run from Apps Script editor: seedTestIncidents()
 * Safe to re-run — each row gets a new incident_id.
 */

function seedTestIncidents() {
  var ss = getSpreadsheet_();
  ensureWorkbookSheets_(ss);

  var locations = readLocations_(ss);
  var types = readIncidentTypes_(ss);
  var helpOptions = readHelpOptions_(ss);
  var incidents = ss.getSheetByName(configSheet_('INCIDENTS_SHEET', 'Incidents'));

  if (!locations.length) {
    throw new Error('No locations — run setupCleanWorkbook() first.');
  }

  var samples = buildSeedSamples_(locations, types, helpOptions);
  var created = [];

  samples.forEach(function (sample) {
    var incidentId = nextIncidentId_(incidents);
    var row = buildIncidentRow_({
      incidentId: incidentId,
      timestamp: sample.timestamp || new Date(),
      department: sample.department,
      locationId: sample.locationId,
      sectorRow: sample.sectorRow,
      sectorColumn: sample.sectorColumn,
      sectorLabel: '',
      incidentTypeId: sample.incidentTypeId,
      description: sample.description,
      helpOptionIds: sample.helpOptionIds,
      priority: sample.priority,
      reporter: sample.reporter,
      status: sample.status || CONFIG.DEFAULT_STATUS,
      actionOwner: sample.actionOwner || '',
      updateNotes: sample.updateNotes || '',
      sourceRow: 'seed-test-data',
      latitude: sample.latitude || '',
      longitude: sample.longitude || ''
    });

    incidents.appendRow(row);
    var newRow = incidents.getLastRow();
    applySingleIncidentFormulas_(incidents, newRow);
    created.push(incidentId);
  });

  refreshIncidentsView_(ss);
  SpreadsheetApp.flush();

  Logger.log('seedTestIncidents complete — ' + created.length + ' row(s): ' + created.join(', '));
  return created;
}

function buildSeedSamples_(locations, types, helpOptions) {
  var loc = function (id) {
    return locations.filter(function (l) { return l.id === id; })[0] || locations[0];
  };
  var type = function (dept, hint) {
    var match = types.filter(function (t) {
      return t.department === dept && t.name.toLowerCase().indexOf(hint) !== -1;
    })[0];
    if (match) return match;
    return types.filter(function (t) { return t.department === dept; })[0];
  };
  var helpIds = function (dept, n) {
    return helpOptions
      .filter(function (h) { return h.departments.indexOf(dept) !== -1; })
      .slice(0, n || 1)
      .map(function (h) { return h.id; })
      .join(',');
  };

  var now = new Date();

  return [
    {
      department: 'Parkeer',
      locationId: loc('loc-hal12').id,
      sectorRow: 'F',
      sectorColumn: 8,
      incidentTypeId: type('Parkeer', 'geblokkeerd').id,
      priority: 'Critical',
      helpOptionIds: helpIds('Parkeer', 2),
      reporter: 'Testdata — Parkeer centralist',
      description: '[TEST] Toegang geblokkeerd bij Hal 12.',
      status: 'Open'
    },
    {
      department: 'Dienstverlening',
      locationId: loc('loc-hal8').id,
      sectorRow: 'C',
      sectorColumn: 12,
      incidentTypeId: type('Dienstverlening', 'brand').id,
      priority: 'Hoog',
      helpOptionIds: helpIds('Dienstverlening'),
      reporter: 'Testdata — Hal 8 post',
      description: '[TEST] Rookmelding bij foodcourt.',
      status: 'In behandeling',
      actionOwner: 'Coördinator DV',
      updateNotes: 'Beveiliging onderweg'
    },
    {
      department: 'EHBO',
      locationId: loc('loc-hal3').id,
      sectorRow: 'D',
      sectorColumn: 15,
      incidentTypeId: type('EHBO', 'medisch').id,
      priority: 'Critical',
      helpOptionIds: resolveHelpIdsFromList_(
        helpIds('EHBO').split(',').filter(Boolean),
        helpOptions,
        true
      ),
      reporter: 'Testdata — EHBO post Hal 3',
      description: '[TEST] Bezoeker kortademig [betrokkenen: 1]',
      status: 'Open',
      timestamp: new Date(now.getTime() - 45 * 60 * 1000)
    },
    {
      department: 'Parkeer',
      locationId: loc('loc-p4').id,
      sectorRow: 'A',
      sectorColumn: 3,
      incidentTypeId: type('Parkeer', 'parkeer').id,
      priority: 'Laag',
      helpOptionIds: helpIds('Parkeer'),
      reporter: 'Testdata — P4 wacht',
      description: '[TEST] Onjuist geparkeerde auto (afgehandeld).',
      status: 'Afgesloten',
      actionOwner: 'Parkeer',
      updateNotes: 'Voertuig verplaatst',
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000)
    }
  ];
}
