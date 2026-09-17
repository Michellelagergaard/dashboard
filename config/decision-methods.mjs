export const checkpointPolicy = { version: 1, startedAt: "2026-09-17T00:00:00.000Z", days: [1, 7], toleranceHours: 6 };
const hour = 3600000;
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}
export function checkpointStatus(mailing, day, asOf) {
  const point = mailing.checkpoints?.find(point => point.day === day);
  if (point) return { status: "captured", point };
  const sent = Date.parse(mailing.sentAt);
  if (!Number.isFinite(sent) || sent < Date.parse(checkpointPolicy.startedAt)) return { status: "historical" };
  const elapsed = (Date.parse(asOf)-sent)/hour;
  return { status: elapsed < day*24 ? "waiting" : elapsed <= day*24+checkpointPolicy.toleranceHours ? "due" : "missed" };
}
export function comparisonPoint(mailing, audience = "", mode = "history", metric = "clickRate") {
  const checkpoint = mode === "history" ? null : mailing.checkpoints?.find(point => point.day === Number(mode));
  const source = mode === "history" ? mailing : checkpoint;
  const data = audience ? source?.segmentPerformance?.find(row => row.name === audience) : source;
  const value = data?.[metric];
  const size = audience ? data?.recipients ?? Number(String(data?.recipientsLabel || "").replaceAll(".", "")) : data?.delivered;
  return { mailing, value: Number.isFinite(value) ? value : null, size: Number.isFinite(size) && size > 0 ? size : null, version: data?.measurementVersion ?? source?.measurementVersion ?? null, capturedAt: audience ? checkpoint?.segmentsObservedAt : checkpoint?.capturedAt };
}
export function normalLevel(rows, selected, { audience = "", mode = "history", metric = "clickRate", asOf = "" } = {}) {
  const current = comparisonPoint(selected, audience, mode, metric);
  const mature = mode !== "history" || Date.parse(asOf)-Date.parse(selected.sentAt) >= 7*24*hour;
  const earlier = rows.filter(row => Date.parse(row.sentAt) < Date.parse(selected.sentAt)).sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt));
  const candidates = earlier.map(row => comparisonPoint(row,audience,mode,metric)).filter(point => point.value !== null && current.size !== null && point.size !== null
    && point.size/current.size >= .75 && point.size/current.size <= 1.25
    && (mode === "history" ? Date.parse(asOf)-Date.parse(point.mailing.sentAt) >= 7*24*hour : point.version === current.version && point.version !== null));
  const used = candidates.slice(0,5);
  const available = current.value !== null && used.length >= 3;
  const baseline = available ? median(used.map(point=>point.value)) : null;
  return { current, baseline, delta: baseline === null || !mature ? null : current.value-baseline, used, count: used.length, mature, excluded: earlier.length-candidates.length,
    low: available ? Math.min(...used.map(point=>point.value)) : null, high: available ? Math.max(...used.map(point=>point.value)) : null };
}

// Creates at most one immutable observation per issue/day. A late job never
// invents an earlier result, and a missing audience lookup is never backfilled.
export function recordCheckpoints(ledger, issue, segmentPerformance = [], segmentsObservedAt = null) {
  const sent = Date.parse(issue.sentAt), captured = Date.parse(issue.fetchedAt);
  if (!Number.isFinite(sent) || !Number.isFinite(captured) || sent < Date.parse(checkpointPolicy.startedAt)) return ledger;
  if (!(issue.delivered > 0) || !Number.isFinite(issue.openRate) || !Number.isFinite(issue.clickRate) || issue.measurementVersion !== 2) return ledger;
  const ageHours = (captured-sent)/hour;
  const records = [...ledger.records];
  for (const day of checkpointPolicy.days) {
    if (ageHours < day*24 || ageHours > day*24+checkpointPolicy.toleranceHours || records.some(row=>row.mailingId===issue.id&&row.day===day)) continue;
    const segmentAge = (Date.parse(segmentsObservedAt)-sent)/hour;
    const validSegments = segmentAge >= day*24 && segmentAge <= day*24+checkpointPolicy.toleranceHours
      ? segmentPerformance.filter(row => row.measurementVersion === 2 && row.delivered > 0) : [];
    records.push({ mailingId: issue.id, day, capturedAt: issue.fetchedAt, ageHours, sentAt: issue.sentAt,
      delivered: issue.delivered, openRate: issue.openRate, clickRate: issue.clickRate, unsubscribes: issue.unsubscribes,
      measurementVersion: issue.measurementVersion, measurement: issue.measurement,
      segmentPerformance: validSegments, segmentsObservedAt: validSegments.length ? segmentsObservedAt : null });
  }
  return { ...ledger, records };
}
export function validateCheckpointLedger(value) {
  if (value?.version !== 1 || !Array.isArray(value.records)) throw Error("Ugyldigt målepunktsarkiv; eksisterende data må ikke erstattes.");
  const keys = new Set();
  for (const row of value.records) {
    const key = JSON.stringify([row.mailingId,row.day]);
    if (!row.mailingId || !checkpointPolicy.days.includes(row.day) || keys.has(key) || !Number.isFinite(Date.parse(row.capturedAt)) || !Array.isArray(row.segmentPerformance)
      || !(row.delivered>0) || !Number.isFinite(row.clickRate) || !Number.isFinite(row.openRate)) throw Error("Ugyldig eller dubleret måling i arkivet.");
    keys.add(key);
  }
  return value;
}
export function mergeCheckpointLedgers(saved, incoming) {
  validateCheckpointLedger(saved); validateCheckpointLedger(incoming);
  const rows = new Map(saved.records.map(row=>[JSON.stringify([row.mailingId,row.day]),row]));
  for (const row of incoming.records) { const key=JSON.stringify([row.mailingId,row.day]); if (!rows.has(key)) rows.set(key,row); }
  return { version: 1, records: [...rows.values()] };
}
