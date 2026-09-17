import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchIssueLinkCatalog, fetchIssueLinkPerformance, fetchIssueSegmentLinkData, fetchIssueSegmentPerformance, fetchIssueSegmentSubjects, fetchSentIssues } from "./ungapped-client.mjs";
import { mergeHistoricalMailing, supplementHistoricalSegments, publicSegmentRows } from "./dashboard-history.mjs";
import { segmentMappingVersion } from "../config/member-segments.mjs";

const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const newsletterTag = "Psykologernes Nyhedsbrev";
const historyCacheUrl = new URL("../.cache/dashboard-history.json", import.meta.url);
const baselineUrl = new URL("../data/dashboard-history-baseline.json", import.meta.url);
const historyCutoff = new Date();
historyCutoff.setUTCMonth(historyCutoff.getUTCMonth() - 1);
const historyById = await loadHistoryCache(historyCacheUrl);
const preMeasurementArchive = JSON.parse(await readFile(new URL("../data/pre-measurement-v2.json", import.meta.url), "utf8"));
for (const mailing of preMeasurementArchive.mailings) {
  if (historyById.has(mailing.id)) historyById.set(mailing.id, mergeHistoricalMailing(historyById.get(mailing.id), mailing));
  else historyById.set(mailing.id, mailing);
}
const baselineById = await loadBaseline(baselineUrl);
const issues = await fetchSentIssues(apiKey);
const sorted = issues
  .filter((issue) => (issue.tags || []).some((tag) => normalize(tag) === normalize(newsletterTag)))
  .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

if (sorted.length === 0) {
  throw new Error(`Ingen sendte udsendelser havde tagget "${newsletterTag}". Seneste gyldige dashboard bevares.`);
}

// Dashboardet er afgrænset til det redaktionelle nyhedsbrev via det dokumenterede tag.
// Målgruppetal og dynamiske emnefelter hentes for alle udgaver fra de seneste
// 12 måneder. De langsommere målgruppefordelte linkopslag begrænses til fem.
const segmentCutoff = new Date();
segmentCutoff.setUTCFullYear(segmentCutoff.getUTCFullYear() - 1);
const segmentIssueIds = new Set(sorted
  .filter((issue) => issue.delivered >= 500 && issue.sentAt && new Date(issue.sentAt) >= segmentCutoff)
  .map((issue) => issue.id));
const segmentLinkIssueIds = new Set(sorted.filter((issue) => segmentIssueIds.has(issue.id)).slice(0, 5).map((issue) => issue.id));
const linkIssueIds = new Set(sorted.slice(0, 12).map((issue) => issue.id));

const mailings = await mapConcurrent(sorted, 1, async (issue) => {
  const historicalMailing = historyById.has(issue.id)
    ? mergeHistoricalMailing(historyById.get(issue.id), baselineById.get(issue.id))
    : baselineById.has(issue.id) ? mergeHistoricalMailing(emptyMailing(issue), baselineById.get(issue.id)) : undefined;
  if (isOlderThan(issue.sentAt, historyCutoff) && historicalMailing) {
    return supplementHistoricalSegments(historicalMailing, {
      performance: segments => safe(() => fetchIssueSegmentPerformance(apiKey, issue.id, fetch, segments), { available: false, results: [] }),
      subjects: () => safe(() => fetchIssueSegmentSubjects(apiKey, issue.id), []),
      links: segments => safe(() => fetchIssueSegmentLinkData(apiKey, issue.id, fetch, segments), { available: false, results: [] }),
    }, segmentLinkIssueIds.has(issue.id) || historicalMailing.segmentLinkPerformance?.length > 0);
  }

  const includeLinks = linkIssueIds.has(issue.id);
  const includeSegments = segmentIssueIds.has(issue.id);
  const includeSegmentLinks = segmentLinkIssueIds.has(issue.id);
  let links = [];
  if (includeLinks) {
    try { links = (await fetchIssueLinkCatalog(apiKey, issue.id)).links; } catch { /* Keep last valid rows from the remaining issues. */ }
  }
  const linkPerformance = includeLinks ? await safe(() => fetchIssueLinkPerformance(apiKey, issue.id), { available: false, results: [] }) : { available: false, results: [] };
  const segmentData = includeSegments ? await safe(() => fetchIssueSegmentPerformance(apiKey, issue.id), { available: false, results: [] }) : { available: false, results: [] };
  const segmentLinkData = includeSegmentLinks ? await safe(() => fetchIssueSegmentLinkData(apiKey, issue.id), { available: false, results: [] }) : { available: false, results: [] };
  const segmentLinkPerformance = segmentLinkData.results;
  const segmentSubjects = includeSegments ? await safe(() => fetchIssueSegmentSubjects(apiKey, issue.id), []) : [];
  const segmentRecipientCounts = new Map(segmentData.results.map((item) => [item.name, item.recipients]));
  const linkTitles = new Map(links.map((item) => [item.destination, item.title]).filter(([, title]) => title));
  const mailing = {
    ...emptyMailing(issue),
    content: linkPerformance.results.filter((item) => item.clicks >= 5).map((item) => ({ title: linkTitles.get(item.destination) || item.title, destination: item.destination, recipients: issue.delivered, clicks: item.clicks, rate: item.clicks / Math.max(1, issue.delivered) * 100, clickMeasurement: item.clickMeasurement })),
    links,
    segments: issue.classificationMetadata?.segments || [],
    segmentPerformance: publicSegmentRows(segmentData.results),
    segmentSubjects,
    segmentLinkPerformance: segmentLinkPerformance.filter(item => segmentRecipientCounts.get(item.audience) > 0).map((item) => ({ title: linkTitles.get(item.destination) || item.title, destination: item.destination, audience: item.audience, clicks: item.clicks, rate: item.clicks / segmentRecipientCounts.get(item.audience) * 100, clickMeasurement: item.clickMeasurement })),
    ...(segmentData.available ? { segmentMappingVersion } : {}),
    ...(segmentLinkData.available ? { segmentLinkMappingVersion: segmentMappingVersion } : {}),
    dataCoverage: {
      linkPerformance: Boolean(includeLinks && linkPerformance.available),
      segmentPerformance: Boolean(includeSegments && segmentData.available),
      segmentSubjects: Boolean(includeSegments && segmentSubjects.length),
      segmentLinkPerformance: Boolean(includeSegmentLinks && segmentLinkPerformance.length),
    },
  };
  return mergeHistoricalMailing(mailing, historicalMailing || baselineById.get(issue.id));
});

// Also keep recorded issues if an API page temporarily omits them.
const currentIds = new Set(mailings.map(mailing => mailing.id));
for (const [id, saved] of historyById) {
  if (!currentIds.has(id)) mailings.push(mergeHistoricalMailing(saved, baselineById.get(id)));
}
mailings.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

const data = { mailings, updatedAt: new Date().toISOString(), status: "live" };
await writeFile(new URL("../app/generated-dashboard-data.ts", import.meta.url), `import type { LiveDashboardData } from "./live-data";\n\nexport const generatedDashboardData = ${JSON.stringify(data)} as const satisfies LiveDashboardData;\n`, "utf8");
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(historyCacheUrl, `${JSON.stringify({ version: 2, updatedAt: data.updatedAt, mailings })}\n`, "utf8");
console.log("Målgruppedækning: " + JSON.stringify(Object.fromEntries(
  ["Dimittender", "Ledige", "Ydernummerpsykologer", "Pensionister"].map(name => [name, mailings.filter(mailing => mailing.segmentPerformance.some(row => row.name === name)).length]),
)));
console.log(`Historik bevaret: ${historyById.size} cacheudgaver, ${baselineById.size} grundlagsudgaver. Dashboard: ${mailings.length} udgaver.`);

function emptyMailing(issue) {
  return {
    id: issue.id, title: issue.name || issue.subject || "Uden titel", subject: issue.subject || "Emnefelt mangler",
    type: newsletterTag, date: formatDate(issue.sentAt), sentAt: issue.sentAt,
    delivered: issue.delivered, openRate: issue.openRate ?? 0, clickRate: issue.clickRate ?? 0, unsubscribes: issue.unsubscribes ?? 0,
    measurementVersion: issue.measurementVersion, measurement: issue.measurement,
    content: [], links: [], segments: issue.classificationMetadata?.segments || [],
    segmentPerformance: [], segmentSubjects: [], segmentLinkPerformance: [],
    dataCoverage: { linkPerformance: false, segmentPerformance: false, segmentSubjects: false, segmentLinkPerformance: false },
  };
}

function normalize(value) { return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("da-DK"); }
function formatDate(value) { if (!value) return "Dato mangler"; return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" }).format(new Date(value)); }
function isOlderThan(value, cutoff) { return Boolean(value) && new Date(value) < cutoff; }
async function loadHistoryCache(url) {
  try {
    const cached = JSON.parse(await readFile(url, "utf8"));
    if (cached?.version !== 2 || !Array.isArray(cached.mailings)) return new Map();
    return new Map(cached.mailings.filter(isValidCachedMailing).map((mailing) => [mailing.id, mailing]));
  } catch {
    return new Map();
  }
}
async function loadBaseline(url) {
  try {
    const baseline = JSON.parse(await readFile(url, "utf8"));
    if (baseline?.version !== 1 || !Array.isArray(baseline.mailings)) return new Map();
    return new Map(baseline.mailings.filter((mailing) => typeof mailing?.id === "string").map((mailing) => [mailing.id, mailing]));
  } catch {
    return new Map();
  }
}
function isValidCachedMailing(mailing) {
  return mailing && typeof mailing.id === "string" && typeof mailing.sentAt === "string"
    && Array.isArray(mailing.content) && Array.isArray(mailing.links)
    && Array.isArray(mailing.segmentPerformance) && Array.isArray(mailing.segmentSubjects)
    && Array.isArray(mailing.segmentLinkPerformance) && mailing.dataCoverage
    && typeof mailing.dataCoverage.linkPerformance === "boolean"
    && typeof mailing.dataCoverage.segmentPerformance === "boolean"
    && typeof mailing.dataCoverage.segmentSubjects === "boolean"
    && typeof mailing.dataCoverage.segmentLinkPerformance === "boolean";
}
async function mapConcurrent(items, concurrency, mapper) { const output = new Array(items.length); let next = 0; async function worker() { while (next < items.length) { const index = next++; output[index] = await mapper(items[index], index); } } await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)); return output; }
async function safe(operation, fallback) { try { return await operation(); } catch { return fallback; } }
