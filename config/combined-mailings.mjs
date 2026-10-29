import { isMemberCommunication } from './dashboard-tags.mjs';
// Explicit editorial grouping: source issues and their stored history stay intact.
export const combinedMailingGroups = [{
  ids: ["0882c536-e05f-4276-8b12-6dcb25c77903", "3863b09d-4848-4650-a67c-3e5d086b1c4b"],
  subject: "Regionernes udbud efterlader huller i behandlingstilbuddet til unge",
}];

export function canonicalMailingId(id) {
  return combinedMailingGroups.find(group => group.ids.includes(id))?.ids[0] || id;
}

const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
const count = (rows, field) => rows.every(row => Number.isFinite(row[field])) ? sum(rows, field) : undefined;
const rate = (value, base) => base > 0 ? value / base * 100 : 0;
const latest = values => values.filter(Boolean).sort().at(-1);
const oldest = values => values.every(Boolean) ? [...values].sort()[0] : undefined;

function totals(rows) {
  const delivered = sum(rows, "delivered");
  const openCount = count(rows, "openCount");
  const clickCount = count(rows, "clickCount");
  return {
    delivered, openCount, clickCount,
    openRate: rate(openCount ?? rows.reduce((n, row) => n + row.openRate * row.delivered / 100, 0), delivered),
    clickRate: rate(clickCount ?? rows.reduce((n, row) => n + row.clickRate * row.delivered / 100, 0), delivered),
    unsubscribes: count(rows, "unsubscribes") ?? null,
  };
}

function segments(parts) {
  const names = new Set(parts.flatMap(part => (part.segmentPerformance || []).map(row => row.name)));
  return [...names].flatMap(name => {
    const rows = parts.map(part => part.segmentPerformance?.find(row => row.name === name));
    // An absent segment can mean a suppressed or failed lookup, not zero people.
    if (rows.some(row => !row || !Number.isFinite(row.delivered) || !Number.isFinite(row.recipients))) return [];
    const merged = totals(rows);
    const recipients = sum(rows, "recipients");
    return [{ ...rows[0], ...merged, name, recipients,
      recipientsLabel: recipients.toLocaleString("da-DK"),
      observedAt: oldest(rows.map(row => row.observedAt)),
      ctor: merged.openRate > 0 ? merged.clickRate / merged.openRate * 100 : 0,
    }];
  });
}

function mergeLinks(parts, field, delivered, segmentRows, id) {
  const grouped = new Map();
  for (const [partIndex, part] of parts.entries()) {
    for (const row of part[field] || []) {
      const key = JSON.stringify([row.destination, row.audience || "", row.clickMeasurement?.metric || "historical"]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ row, partIndex });
    }
  }
  return [...grouped.values()].flatMap(entries => {
    const rows = entries.map(entry => entry.row);
    const first = rows[0];
    const base = first.audience ? segmentRows.find(row => row.name === first.audience)?.recipients : delivered;
    if (!(base > 0)) return [];
    const clicks = sum(rows, "clicks");
    const partial = new Set(entries.map(entry => entry.partIndex)).size !== parts.length;
    const measurement = first.clickMeasurement;
    return [{ ...first, clicks, rate: rate(clicks, base),
      ...(field === "content" ? { recipients: delivered } : {}),
      ...(measurement ? { clickMeasurement: { ...measurement,
        sourceRows: rows.reduce((n, row) => n + (row.clickMeasurement?.sourceRows || 1), 0),
        // Missing rows may be below Ungapped's publication threshold.
        aggregation: partial || rows.some(row => row.clickMeasurement?.aggregation === "max-per-destination") ? "max-per-destination" : "single-link",
      } } : {}),
      ...(first.editorial ? { editorial: { ...first.editorial, mailingId: id } } : {}),
    }];
  });
}

function mergeParts(parts, group) {
  const id = group.ids[0];
  const segmentPerformance = segments(parts);
  const mergedTotals = totals(parts);
  const sentAt = latest(parts.map(part => part.sentAt));
  const links = [...new Map(parts.flatMap(part => part.links || []).map(row => [row.destination, {
    ...row, ...(row.editorial ? { editorial: { ...row.editorial, mailingId: id } } : {}),
  }])).values()];
  const checkpoints = [...new Set(parts.flatMap(part => (part.checkpoints || []).map(point => point.day)))].flatMap(day => {
    const points = parts.map(part => part.checkpoints?.find(point => point.day === day));
    if (points.some(point => !point)) return [];
    const capturedAt = latest(points.map(point => point.capturedAt));
    return [{ ...points[0], ...totals(points), mailingId: id, day, sentAt, capturedAt,
      ageHours: (Date.parse(capturedAt) - Date.parse(sentAt)) / 3600000,
      segmentPerformance: segments(points),
      segmentsObservedAt: oldest(points.map(point => point.segmentsObservedAt)) || null,
    }];
  });
  return { ...parts[0], ...mergedTotals, id, title: group.subject, subject: group.subject, sentAt,
    observedAt: oldest(parts.map(part => part.observedAt)),
    deliveryParts: parts.map(part => ({ id: part.id, sentAt: part.sentAt })),
    segments: [...new Set(parts.flatMap(part => part.segments || []))],
    segmentSubjects: [...new Map(parts.flatMap(part => part.segmentSubjects || []).map(row => [JSON.stringify([row.audience, row.subject]), row])).values()],
    segmentPerformance, links, checkpoints,
    editorialCatalog: [...new Map(parts.flatMap(part => part.editorialCatalog || []).map(row => [row.destination, row])).values()],
    content: mergeLinks(parts, "content", mergedTotals.delivered, segmentPerformance, id),
    segmentLinkPerformance: mergeLinks(parts, "segmentLinkPerformance", mergedTotals.delivered, segmentPerformance, id),
    dataCoverage: Object.fromEntries(["linkPerformance", "segmentPerformance", "segmentSubjects", "segmentLinkPerformance"].map(key => [key, parts.every(part => part.dataCoverage?.[key] === true)])),
  };
}

export function combineMailings(mailings) {
  let result = mailings;
  for (const group of combinedMailingGroups) {
    const parts = group.ids.map(id => result.find(mailing => mailing.id === id));
    if (parts.some(part => !part) || parts.some(part => part.type !== "Psykologernes Nyhedsbrev") || parts.some(isMemberCommunication)) continue;
    const merged = mergeParts(parts, group);
    result = result.filter(mailing => !group.ids.includes(mailing.id));
    result = [...result, merged];
  }
  return result;
}
