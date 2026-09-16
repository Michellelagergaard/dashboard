import { correctedMemberSegments, segmentMappingVersion } from "../config/member-segments.mjs";

// Merge by stable row identity: partial API replies must never remove saved rows.
export function mergeHistoricalMailing(mailing, baseline) {
  if (!baseline) return mailing;
  const merge = (field, key) => [...new Map([
    ...(baseline[field] || []), ...(mailing[field] || []),
  ].map(row => [key(row), row])).values()];
  const content = merge("content", row => row.destination);
  const links = merge("links", row => row.destination);
  const segmentPerformance = merge("segmentPerformance", row => row.name);
  const segmentSubjects = merge("segmentSubjects", row => row.audience);
  const segmentLinkPerformance = merge("segmentLinkPerformance", row => JSON.stringify([row.audience, row.destination]));
  return {
    ...baseline, ...mailing, content, links, segmentPerformance, segmentSubjects, segmentLinkPerformance,
    dataCoverage: {
      ...baseline.dataCoverage, ...mailing.dataCoverage,
      linkPerformance: content.length > 0 || Boolean(mailing.dataCoverage?.linkPerformance),
      segmentPerformance: segmentPerformance.length > 0 || Boolean(mailing.dataCoverage?.segmentPerformance),
      segmentSubjects: segmentSubjects.length > 0 || Boolean(mailing.dataCoverage?.segmentSubjects),
      segmentLinkPerformance: segmentLinkPerformance.length > 0 || Boolean(mailing.dataCoverage?.segmentLinkPerformance),
    },
  };
}

export function publicSegmentRows(rows) {
  return rows.map(item => ({
    name: item.name, recipientsLabel: item.recipients.toLocaleString("da-DK"),
    openRate: item.openRate ?? 0, clickRate: item.clickRate ?? 0,
    ctor: item.ctor ?? 0, unsubscribes: item.unsubscribes,
  }));
}

// Historical totals and existing audiences stay frozen. Only missing audiences
// are supplemented; failed lookups remain retryable on the next hourly run.
export async function supplementHistoricalSegments(mailing, { performance, subjects, links }, includeLinks) {
  let result = mailing;
  const missing = correctedMemberSegments.filter(segment => !mailing.segmentPerformance.some(row => row.name === segment.label));
  if (mailing.segmentMappingVersion !== segmentMappingVersion) {
    const data = missing.length ? await performance(missing) : { available: true, results: [] };
    const newSubjects = await subjects();
    result = mergeHistoricalMailing({
      ...mailing,
      segmentPerformance: publicSegmentRows(data.results),
      segmentSubjects: newSubjects.filter(row => !mailing.segmentSubjects.some(old => old.audience === row.audience)),
      ...(data.available ? { segmentMappingVersion } : {}),
    }, mailing);
  }
  if (includeLinks && mailing.segmentLinkMappingVersion !== segmentMappingVersion) {
    const data = await links(correctedMemberSegments);
    const recipients = new Map(result.segmentPerformance.map(row => [row.name, Number(row.recipientsLabel.replace(/\D/g, ""))]));
    const titles = new Map([...(result.links || []), ...(result.content || [])].filter(row => row.title).map(row => [row.destination, row.title]));
    const oldKeys = new Set(result.segmentLinkPerformance.map(row => JSON.stringify([row.audience, row.destination])));
    result = mergeHistoricalMailing({
      ...result,
      segmentLinkPerformance: data.results
        .filter(row => recipients.get(row.audience) > 0 && !oldKeys.has(JSON.stringify([row.audience, row.destination])))
        .map(row => ({ ...row, title: titles.get(row.destination) || row.title, rate: row.clicks / recipients.get(row.audience) * 100 })),
      ...(data.available ? { segmentLinkMappingVersion: segmentMappingVersion } : {}),
    }, result);
  }
  return result;
}
