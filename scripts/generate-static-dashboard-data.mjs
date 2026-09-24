import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchIssueEditorialCatalog, fetchIssueLinkCatalog, fetchIssueLinkPerformance, fetchIssueSegmentLinkData, fetchIssueSegmentPerformance, fetchIssueSegmentSubjects, fetchSentIssues } from "./ungapped-client.mjs";
import { editorialCatalogVersion } from "./editorial-catalog.mjs";
import { mergeHistoricalMailing, replaceHistoricalLinkPerformance, supplementHistoricalSegments, publicSegmentRows } from "./dashboard-history.mjs";
import { memberSegments, segmentMappingVersion } from "../config/member-segments.mjs";
import { mergeCheckpointLedgers, recordCheckpoints, validateCheckpointLedger } from "../config/decision-methods.mjs";

const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");
const checkpointUrl = new URL("../.cache/measurement-checkpoints.json", import.meta.url);
let checkpoints;
try { checkpoints = validateCheckpointLedger(JSON.parse(await readFile(checkpointUrl, "utf8"))); }
catch (error) { if (error.code !== "ENOENT") throw error; checkpoints = { version: 1, records: [] }; }

const newsletterTags = ["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P", "TR/AMR Nyt"];
const historyCacheUrl = new URL("../.cache/dashboard-history.json", import.meta.url);
const baselineUrl = new URL("../data/dashboard-history-baseline.json", import.meta.url);
const historyCutoff = new Date();
historyCutoff.setUTCMonth(historyCutoff.getUTCMonth() - 1);
const historyById = await loadHistoryCache(historyCacheUrl);
// Newest archive first; current cache always wins. Older snapshots remain intact.
for (const filename of ["pre-decisions-v1.json", "pre-editorial-v1.json", "pre-measurement-v2.json"]) {
  const archive = JSON.parse(await readFile(new URL(`../data/${filename}`, import.meta.url), "utf8"));
  for (const mailing of archive.mailings) {
    if (historyById.has(mailing.id)) historyById.set(mailing.id, mergeHistoricalMailing(historyById.get(mailing.id), mailing));
    else historyById.set(mailing.id, mailing);
  }
}
const baselineById = await loadBaseline(baselineUrl);
checkpoints = mergeCheckpointLedgers(checkpoints, { version: 1, records: [...historyById.values()].flatMap(mailing => mailing.checkpoints || []) });
const issues = await fetchSentIssues(apiKey);
const sorted = issues
  .map((issue) => ({ ...issue, dashboardType: newsletterTags.find((name) => (issue.tags || []).some((tag) => normalize(tag) === normalize(name))) || null }))
  .filter((issue) => issue.dashboardType)
  .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

if (sorted.length === 0) {
  throw new Error(`Ingen sendte udsendelser havde taggene ${newsletterTags.map(tag => `"${tag}"`).join(" eller ")}. Seneste gyldige dashboard bevares.`);
}

// Målgruppetal hentes for de tre medlemsrettede nyhedsbreve i de seneste
// 12 måneder. Dynamiske emnefelter og de langsommere målgruppefordelte
// linkopslag er fortsat afgrænset til Psykologernes Nyhedsbrev.
const segmentCutoff = new Date();
segmentCutoff.setUTCFullYear(segmentCutoff.getUTCFullYear() - 1);
const audienceProfileTypes = new Set(["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P"]);
const segmentIssueIds = new Set(sorted
  .filter((issue) => audienceProfileTypes.has(issue.dashboardType) && issue.delivered >= 500 && issue.sentAt && new Date(issue.sentAt) >= segmentCutoff)
  .map((issue) => issue.id));
const segmentLinkIssueIds = new Set(sorted.filter((issue) => issue.dashboardType === "Psykologernes Nyhedsbrev" && segmentIssueIds.has(issue.id)).slice(0, 5).map((issue) => issue.id));
const linkIssueIds = new Set([
  ...sorted.filter((issue) => issue.dashboardType === "Psykologernes Nyhedsbrev" && issue.sentAt && new Date(issue.sentAt) >= segmentCutoff).map((issue) => issue.id),
  ...newsletterTags.filter(type => type !== "Psykologernes Nyhedsbrev").flatMap((type) => sorted.filter((issue) => issue.dashboardType === type).slice(0, 12).map((issue) => issue.id)),
]);

const mailings = await mapConcurrent(sorted, 1, async (issue) => {
  const historicalMailing = historyById.has(issue.id)
    ? mergeHistoricalMailing(historyById.get(issue.id), baselineById.get(issue.id))
    : baselineById.has(issue.id) ? mergeHistoricalMailing(emptyMailing(issue), baselineById.get(issue.id)) : undefined;
  if (isOlderThan(issue.sentAt, historyCutoff) && historicalMailing) {
    if (issue.dashboardType !== "Psykologernes Nyhedsbrev") {
      if (!segmentIssueIds.has(issue.id)) return historicalMailing;
      return supplementHistoricalSegments(historicalMailing, {
        performance: segments => safe(() => fetchIssueSegmentPerformance(apiKey, issue.id, fetch, segments), { available: false, results: [] }),
        subjects: async () => [],
        links: async () => ({ available: false, results: [] }),
      }, false, memberSegments);
    }
    let refreshedHistory = historicalMailing;
    if (linkIssueIds.has(issue.id) && historicalMailing.linkMeasurementVersion !== 2) {
      let links = [];
      try { links = (await fetchIssueLinkCatalog(apiKey, issue.id)).links; } catch { /* A later hourly run retries the backfill. */ }
      const performance = await safe(() => fetchIssueLinkPerformance(apiKey, issue.id), { available: false, results: [] });
      refreshedHistory = replaceHistoricalLinkPerformance(historicalMailing, performance, links, issue.delivered);
    }
    return supplementHistoricalSegments(refreshedHistory, {
      performance: segments => safe(() => fetchIssueSegmentPerformance(apiKey, issue.id, fetch, segments), { available: false, results: [] }),
      subjects: () => safe(() => fetchIssueSegmentSubjects(apiKey, issue.id), []),
      links: segments => safe(() => fetchIssueSegmentLinkData(apiKey, issue.id, fetch, segments), { available: false, results: [] }),
    }, segmentLinkIssueIds.has(issue.id) || refreshedHistory.segmentLinkPerformance?.length > 0);
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
  const segmentsObservedAt = new Date().toISOString();
  checkpoints = recordCheckpoints(checkpoints, issue, segmentData.available ? publicSegmentRows(segmentData.results) : [], segmentsObservedAt);
  const segmentLinkData = includeSegmentLinks ? await safe(() => fetchIssueSegmentLinkData(apiKey, issue.id), { available: false, results: [] }) : { available: false, results: [] };
  const segmentLinkPerformance = segmentLinkData.results;
  const segmentSubjects = includeSegments && issue.dashboardType === "Psykologernes Nyhedsbrev" ? await safe(() => fetchIssueSegmentSubjects(apiKey, issue.id), []) : [];
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
    ...(linkPerformance.available ? { linkMeasurementVersion: 2 } : {}),
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

// Descriptive metadata lives beside the frozen measurements. Never rewrite rows.
let enriched = 0;
for (const mailing of mailings) {
  if (!(mailing.content.length || mailing.segmentLinkPerformance?.length || mailing.links.length)) continue;
  if (mailing.editorialCatalogVersion === editorialCatalogVersion) continue;
  try {
    const catalog = await fetchIssueEditorialCatalog(apiKey, mailing.id);
    const merged = new Map((mailing.editorialCatalog || []).map(item => [item.destination, item]));
    for (const item of catalog) merged.set(item.destination, item);
    mailing.editorialCatalog = [...merged.values()];
    mailing.editorialCatalogVersion = editorialCatalogVersion;
    enriched++;
  } catch { console.warn(`Indholdsnavne ikke opdateret for ${mailing.id}; tidligere navne og alle målinger bevares.`); }
}
console.log(`Indholdsmetadata: ${enriched} udgaver beriget; ${mailings.filter(m => m.editorialCatalogVersion === editorialCatalogVersion).length} med gemt katalog.`);

const data = { mailings, updatedAt: new Date().toISOString(), status: "live" };
for (const mailing of mailings) mailing.checkpoints = checkpoints.records.filter(row => row.mailingId === mailing.id);
await writeFile(new URL("../app/generated-dashboard-data.ts", import.meta.url), `import type { LiveDashboardData } from "./live-data";\n\nexport const generatedDashboardData = ${JSON.stringify(data)} as const satisfies LiveDashboardData;\n`, "utf8");
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(checkpointUrl, JSON.stringify(checkpoints)+"\n", "utf8");
await writeFile(historyCacheUrl, `${JSON.stringify({ version: 2, updatedAt: data.updatedAt, mailings })}\n`, "utf8");
console.log("Målgruppedækning: " + JSON.stringify(Object.fromEntries(
  ["Dimittender", "Ledige", "Ydernummerpsykologer", "Pensionister"].map(name => [name, mailings.filter(mailing => mailing.segmentPerformance.some(row => row.name === name)).length]),
)));
console.log(`Historik bevaret: ${historyById.size} cacheudgaver, ${baselineById.size} grundlagsudgaver. Dashboard: ${mailings.length} udgaver.`);

function emptyMailing(issue) {
  return {
    id: issue.id, title: issue.name || issue.subject || "Uden titel", subject: issue.subject || "Emnefelt mangler",
    type: issue.dashboardType || issue.category || "Ikke kategoriseret", date: formatDate(issue.sentAt), sentAt: issue.sentAt,
    delivered: issue.delivered, openRate: issue.openRate ?? 0, clickRate: issue.clickRate ?? 0, unsubscribes: issue.unsubscribes ?? 0,
    measurementVersion: issue.measurementVersion, measurement: issue.measurement, observedAt: issue.fetchedAt,
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
