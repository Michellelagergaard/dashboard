import test from "node:test";
import assert from "node:assert/strict";
import { fetchIssueSegmentPerformance, fetchIssueSegmentLinkData, extractSegmentSubjects } from "../scripts/ungapped-client.mjs";
import { memberSegments, correctedMemberSegments, segmentMappingVersion } from "../config/member-segments.mjs";
import { mergeHistoricalMailing, supplementHistoricalSegments } from "../scripts/dashboard-history.mjs";

const reply = data => ({ ok: true, status: 200, json: async () => data });
const stats = { RecipientCount: 100, ReceivedCount: 90, OpenCount: 45, ClickCount: 9 };

test("overview requests use actual fields for all four audiences and preserve section filters", async () => {
  const filters = [];
  const result = await fetchIssueSegmentPerformance("test", "issue", async url => {
    const filter = url.searchParams.get("contactFilter");
    if (!filter) return reply({ RecipientCount: 1000 });
    filters.push(filter);
    return reply(stats);
  });
  assert.equal(result.results.length, 11);
  for (const [value, field] of [["1 og 2 års kandidater", "CustomLong1"], ["Ledig DP", "CustomLong1"], ["Har ydernummer", "CustomLong2"], [memberSegments.find(x => x.label === "Pensionister").value, "CustomLong1"], ["Hospitalssektionen", "Custom3"]]) {
    assert.ok(filters.some(filter => filter.includes(`indexof(${field}, '${value}')`)));
  }
});

test("filtered link statistics use the same mapping", async () => {
  const filters = [];
  const result = await fetchIssueSegmentLinkData("test", "issue", async url => {
    const filter = url.searchParams.get("contactFilter");
    if (filter) filters.push(filter);
    return reply([{ Url: "https://www.dp.dk/article", ContactCount: filter ? 7 : 100 }]);
  }, correctedMemberSegments);
  assert.equal(result.available, true);
  assert.equal(result.results.length, 4);
  assert.equal(filters.filter(filter => filter.includes("indexof(CustomLong1,")).length, 3);
  assert.equal(filters.filter(filter => filter.includes("indexof(CustomLong2,")).length, 1);
});

test("an ignored filter and groups below five never become audience statistics", async () => {
  const result = await fetchIssueSegmentPerformance("test", "issue", async url => {
    const filter = url.searchParams.get("contactFilter");
    return reply({ ...stats, RecipientCount: !filter || filter.includes("Ledig") ? 1000 : 3, ReceivedCount: !filter || filter.includes("Ledig") ? 1000 : 3 });
  }, correctedMemberSegments);
  assert.deepEqual(result.results, []);
});

const saved = {
  id: "historical", delivered: 1234, sentAt: "2025-10-01T10:00:00Z",
  content: [{ destination: "https://dp.dk/a", clicks: 44 }],
  links: [{ destination: "https://dp.dk/a", title: "Gemt titel" }],
  segmentPerformance: [{ name: "Regionalt ansatte", recipientsLabel: "200", clickRate: 12 }],
  segmentSubjects: [{ audience: "Regionalt ansatte", subject: "Gemt emne" }],
  segmentLinkPerformance: [{ audience: "Regionalt ansatte", destination: "https://dp.dk/a", clicks: 24 }],
  dataCoverage: { linkPerformance: true, segmentPerformance: true, segmentSubjects: true, segmentLinkPerformance: true },
};

test("partial replies merge by row identity without losing previous groups or content", () => {
  const merged = mergeHistoricalMailing({ ...saved, content: [], links: [], segmentSubjects: [], segmentLinkPerformance: [], segmentPerformance: [{ name: "Dimittender", recipientsLabel: "355" }] }, saved);
  assert.deepEqual(merged.content, saved.content);
  assert.deepEqual(merged.links, saved.links);
  assert.deepEqual(merged.segmentSubjects, saved.segmentSubjects);
  assert.deepEqual(merged.segmentLinkPerformance, saved.segmentLinkPerformance);
  assert.deepEqual(merged.segmentPerformance[0], saved.segmentPerformance[0]);
  assert.equal(merged.segmentPerformance.length, 2);
});

test("historical supplementation freezes existing data and runs only once after success", async () => {
  let calls = 0;
  const services = {
    performance: async segments => { calls++; assert.equal(segments.length, 4); return { available: true, results: [{ name: "Dimittender", recipients: 355, clickRate: 10 }] }; },
    subjects: async () => [{ audience: "Regionalt ansatte", subject: "Must not overwrite" }, { audience: "Dimittender", subject: "Dimittendemne" }],
    links: async () => ({ available: true, results: [{ audience: "Dimittender", destination: "https://dp.dk/a", clicks: 5 }] }),
  };
  const result = await supplementHistoricalSegments(saved, services, true);
  assert.equal(result.delivered, saved.delivered);
  assert.deepEqual(result.content, saved.content);
  assert.deepEqual(result.links, saved.links);
  assert.deepEqual(result.segmentSubjects[0], saved.segmentSubjects[0]);
  assert.deepEqual(result.segmentPerformance[0], saved.segmentPerformance[0]);
  assert.deepEqual(result.segmentLinkPerformance[0], saved.segmentLinkPerformance[0]);
  assert.equal(result.segmentLinkPerformance[1].title, "Gemt titel");
  assert.equal(result.segmentLinkPerformance[1].rate, 5 / 355 * 100);
  assert.equal(result.segmentMappingVersion, segmentMappingVersion);
  assert.deepEqual(await supplementHistoricalSegments(result, services, true), result);
  assert.equal(calls, 1);
});

test("failed historical reads preserve all saved rows and remain retryable", async () => {
  const result = await supplementHistoricalSegments(saved, {
    performance: async () => ({ available: false, results: [] }),
    subjects: async () => [],
    links: async () => ({ available: false, results: [] }),
  }, true);
  assert.deepEqual(result, saved);
});

test("distinct saved placements of the same URL survive a destination-level merge", () => {
  const original = { ...saved, content: [{ destination: "https://dp.dk/a", clicks: 43 }, { destination: "https://dp.dk/a", clicks: 35 }] };
  const merged = mergeHistoricalMailing({ ...saved, content: [{ destination: "https://dp.dk/a", clicks: 35 }] }, original);
  assert.deepEqual(merged.content, original.content);
  assert.deepEqual(mergeHistoricalMailing(merged, original).content, original.content);
});

test("dynamic subjects match the documented membership field", () => {
  const rows = extractSegmentSubjects({ DynamicSubject: "{{#compareif Contact.CustomLong1 'contains' '1 og 2 års kandidater'}}Dimittendemne{{/compareif}}{{#compareif Contact.Custom3 'contains' 'Ledig DP'}}Forkert felt{{/compareif}}" });
  assert.deepEqual(rows, [{ audience: "Dimittender", subject: "Dimittendemne" }]);
});
