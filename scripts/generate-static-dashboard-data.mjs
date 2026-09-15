import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fetchIssueLinkCatalog, fetchIssueLinkPerformance, fetchIssueSegmentLinkPerformance, fetchIssueSegmentPerformance, fetchIssueSegmentSubjects, fetchSentIssues } from "./ungapped-client.mjs";

const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const newsletterTag = "Psykologernes Nyhedsbrev";
const historyCacheUrl = new URL("../.cache/dashboard-history.json", import.meta.url);
const historyCutoff = new Date();
historyCutoff.setUTCMonth(historyCutoff.getUTCMonth() - 1);
const historyById = await loadHistoryCache(historyCacheUrl);
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
  const historicalMailing = historyById.get(issue.id);
  if (isOlderThan(issue.sentAt, historyCutoff) && historicalMailing) {
    return historicalMailing;
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
  const segmentLinkPerformance = includeSegmentLinks ? await safe(() => fetchIssueSegmentLinkPerformance(apiKey, issue.id), []) : [];
  const segmentSubjects = includeSegments ? await safe(() => fetchIssueSegmentSubjects(apiKey, issue.id), []) : [];
  const segmentRecipientCounts = new Map(segmentData.results.map((item) => [item.name, item.recipients]));
  return {
    id: issue.id,
    title: issue.name || issue.subject || "Uden titel",
    subject: issue.subject || "Emnefelt mangler",
    type: newsletterTag,
    date: formatDate(issue.sentAt),
    sentAt: issue.sentAt,
    delivered: issue.delivered,
    openRate: issue.openRate ?? 0,
    clickRate: issue.clickRate ?? 0,
    unsubscribes: issue.unsubscribes ?? 0,
    content: linkPerformance.results.filter((item) => item.clicks >= 5).map((item) => ({ title: item.title, destination: item.destination, recipients: issue.delivered, clicks: item.clicks, rate: item.clicks / Math.max(1, issue.delivered) * 100 })),
    links,
    segments: issue.classificationMetadata?.segments || [],
    segmentPerformance: segmentData.results.map((item) => ({ name: item.name, recipientsLabel: item.recipients.toLocaleString("da-DK"), openRate: item.openRate ?? 0, clickRate: item.clickRate ?? 0, ctor: item.ctor ?? 0, unsubscribes: item.unsubscribes })),
    segmentSubjects,
    segmentLinkPerformance: segmentLinkPerformance.map((item) => ({ title: item.title, destination: item.destination, audience: item.audience, clicks: item.clicks, rate: item.clicks / Math.max(1, segmentRecipientCounts.get(item.audience) || 1) * 100 })),
  };
});

const data = { mailings, updatedAt: new Date().toISOString(), status: "live" };
await writeFile(new URL("../app/generated-dashboard-data.ts", import.meta.url), `import type { LiveDashboardData } from "./live-data";\n\nexport const generatedDashboardData = ${JSON.stringify(data)} as const satisfies LiveDashboardData;\n`, "utf8");
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
await writeFile(historyCacheUrl, `${JSON.stringify({ version: 1, updatedAt: data.updatedAt, mailings })}\n`, "utf8");

function normalize(value) { return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("da-DK"); }
function formatDate(value) { if (!value) return "Dato mangler"; return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" }).format(new Date(value)); }
function isOlderThan(value, cutoff) { return Boolean(value) && new Date(value) < cutoff; }
async function loadHistoryCache(url) {
  try {
    const cached = JSON.parse(await readFile(url, "utf8"));
    if (cached?.version !== 1 || !Array.isArray(cached.mailings)) return new Map();
    return new Map(cached.mailings.filter(isValidCachedMailing).map((mailing) => [mailing.id, mailing]));
  } catch {
    return new Map();
  }
}
function isValidCachedMailing(mailing) {
  return mailing && typeof mailing.id === "string" && typeof mailing.sentAt === "string"
    && Array.isArray(mailing.content) && Array.isArray(mailing.links)
    && Array.isArray(mailing.segmentPerformance) && Array.isArray(mailing.segmentSubjects)
    && Array.isArray(mailing.segmentLinkPerformance);
}
async function mapConcurrent(items, concurrency, mapper) { const output = new Array(items.length); let next = 0; async function worker() { while (next < items.length) { const index = next++; output[index] = await mapper(items[index], index); } } await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)); return output; }
async function safe(operation, fallback) { try { return await operation(); } catch { return fallback; } }
