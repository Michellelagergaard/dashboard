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
