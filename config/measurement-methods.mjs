export const measurementVersion = 2;

// Historical segment rows did not retain deliveries. Never reconstruct them
// from recipient labels, rounded percentages, or a later membership lookup.
export function summarizeSegmentRates(rows) {
  const valid = rows.filter(row => Number.isFinite(row.openRate) && Number.isFinite(row.clickRate));
  const weighted = valid.length > 0 && valid.every(row => Number.isFinite(row.delivered) && row.delivered > 0);
  const denominator = weighted ? valid.reduce((sum, row) => sum + row.delivered, 0) : valid.length;
  const average = field => denominator ? valid.reduce((sum, row) => sum + row[field] * (weighted ? row.delivered : 1), 0) / denominator : null;
  return { open: average("openRate"), click: average("clickRate"), method: weighted ? "delivered" : "per-issue", count: valid.length };
}

export function clickMeasurementLabel(item) {
  if (item.clickMeasurement?.metric === "unique-contacts") {
    return item.clickMeasurement.aggregation === "max-per-destination" ? "Mindst dette antal kontakter" : "Unikke kontakter";
  }
  if (item.clickMeasurement?.metric === "total-clicks") return "Samlede klik";
  return "Historisk klikmål";
}

export function isComparableLink(item) {
  return item.clickMeasurement?.metric === "unique-contacts";
}

// Rankings compare one documented measurement type at a time.
export function partitionLinkMeasurements(rows) {
  const contacts = [], events = [], historical = [];
  for (const row of rows) {
    if (row.clickMeasurement?.metric === 'unique-contacts') contacts.push(row);
    else if (row.clickMeasurement?.metric === 'total-clicks') events.push(row);
    else historical.push(row);
  }
  const descending = (a, b) => b.clicks - a.clicks;
  return { contacts: contacts.sort(descending), events: events.sort(descending), historical };
}

export function summarizeCoverage(rows) {
  return {
    total: rows.length,
    links: rows.filter(row => (row.content || []).some(isComparableLink)).length,
    segments: rows.filter(row => (row.segmentPerformance || []).some(item => Number.isFinite(item.openRate) && Number.isFinite(item.clickRate))).length,
    segmentLinks: rows.filter(row => (row.segmentLinkPerformance || []).some(isComparableLink)).length,
  };
}
