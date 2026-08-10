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
