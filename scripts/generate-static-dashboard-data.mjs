import { writeFile } from "node:fs/promises";
import { fetchIssueLinkCatalog, fetchIssueLinkPerformance, fetchIssueSegmentLinkPerformance, fetchIssueSegmentPerformance, fetchSentIssues } from "./ungapped-client.mjs";

const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const newsletterTag = "Psykologernes Nyhedsbrev";
const issues = await fetchSentIssues(apiKey);
const sorted = issues
  .filter((issue) => (issue.tags || []).some((tag) => normalize(tag) === normalize(newsletterTag)))
  .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

// Dashboardet er bevidst afgrænset til det redaktionelle nyhedsbrev. De fem
// seneste udgaver med tilstrækkeligt grundlag får også segment- og segmentlinkdata.
const segmentIssueIds = new Set(sorted.filter((issue) => issue.delivered >= 500).slice(0, 5).map((issue) => issue.id));
const linkIssueIds = new Set(sorted.slice(0, 12).map((issue) => issue.id));

const mailings = await mapConcurrent(sorted, 1, async (issue) => {
  const includeLinks = linkIssueIds.has(issue.id);
  const includeSegments = segmentIssueIds.has(issue.id);
  let links = [];
  if (includeLinks) {
    try { links = (await fetchIssueLinkCatalog(apiKey, issue.id)).links; } catch { /* Keep last valid rows from the remaining issues. */ }
  }
  const linkPerformance = includeLinks ? await fetchIssueLinkPerformance(apiKey, issue.id) : { available: false, results: [] };
  const segmentData = includeSegments ? await fetchIssueSegmentPerformance(apiKey, issue.id) : { available: false, results: [] };
  const segmentLinkPerformance = includeSegments ? await fetchIssueSegmentLinkPerformance(apiKey, issue.id) : [];
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
    segmentLinkPerformance: segmentLinkPerformance.map((item) => ({ title: item.title, destination: item.destination, audience: item.audience, clicks: item.clicks, rate: item.clicks / Math.max(1, segmentRecipientCounts.get(item.audience) || 1) * 100 })),
  };
});

const data = { mailings, updatedAt: new Date().toISOString(), status: "live" };
await writeFile(new URL("../app/generated-dashboard-data.ts", import.meta.url), `import type { LiveDashboardData } from "./live-data";\n\nexport const generatedDashboardData = ${JSON.stringify(data)} as const satisfies LiveDashboardData;\n`, "utf8");

function normalize(value) { return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("da-DK"); }
function formatDate(value) { if (!value) return "Dato mangler"; return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" }).format(new Date(value)); }
async function mapConcurrent(items, concurrency, mapper) { const output = new Array(items.length); let next = 0; async function worker() { while (next < items.length) { const index = next++; output[index] = await mapper(items[index], index); } } await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)); return output; }
