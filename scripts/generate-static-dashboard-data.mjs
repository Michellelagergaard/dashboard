import { writeFile } from "node:fs/promises";
import { fetchIssueLinkCatalog, fetchIssueSegmentLinkPerformance, fetchIssueSegmentPerformance, fetchSentIssues } from "./ungapped-client.mjs";

const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const issues = await fetchSentIssues(apiKey);
const sorted = [...issues].sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));

// Alle medlemssegmenter hentes for de fem seneste udsendelser med et
// forsvarligt minimumsgrundlag. Det gør timekørslen stabil; små grupper
// undertrykkes efter hentning.
const segmentIssueIds = new Set(sorted.filter(issue => issue.delivered >= 500).slice(0, 5).map(issue => issue.id));
const linkIssueIds = new Set(sorted.slice(0, 20).map(issue => issue.id));

const mailings = await mapConcurrent(sorted, 4, async (issue) => {
  let links = [];
  if (linkIssueIds.has(issue.id)) {
    try {
      links = (await fetchIssueLinkCatalog(apiKey, issue.id)).links;
    } catch {
      // En enkelt utilgængelig udsendelse må ikke blokere hele den seneste gyldige udgave.
    }
  }
  const segmentData = segmentIssueIds.has(issue.id)
    ? await fetchIssueSegmentPerformance(apiKey, issue.id)
    : { available: false, results: [] };
  const segmentLinkPerformance = segmentIssueIds.has(issue.id)
    ? await fetchIssueSegmentLinkPerformance(apiKey, issue.id)
    : [];
  const segmentRecipientCounts = new Map(segmentData.results.map(item => [item.name, item.recipients]));
  return {
    id: issue.id,
    title: issue.name || issue.subject || "Uden titel",
    subject: issue.subject || "Emnefelt mangler",
    type: issue.category !== "Ikke kategoriseret"
      ? issue.category
      : issue.suggestedCategory || "Ikke kategoriseret",
    date: formatDate(issue.sentAt),
    sentAt: issue.sentAt,
    delivered: issue.delivered,
    openRate: issue.openRate ?? 0,
    clickRate: issue.clickRate ?? 0,
    unsubscribes: issue.unsubscribes ?? 0,
    content: [],
    links,
    segments: issue.classificationMetadata?.segments || [],
    segmentPerformance: segmentData.results.map(item => ({
      name: item.name,
      recipientsLabel: item.recipients.toLocaleString("da-DK"),
      openRate: item.openRate ?? 0,
      clickRate: item.clickRate ?? 0,
      ctor: item.ctor ?? 0,
      unsubscribes: item.unsubscribes,
    })),
    segmentLinkPerformance: segmentLinkPerformance.map(item => ({
      title: item.title,
      audience: item.audience,
      clicks: item.clicks,
      rate: item.clicks / Math.max(1, segmentRecipientCounts.get(item.audience) || 1) * 100,
    })),
  };
});

const data = {
  mailings,
  updatedAt: new Date().toISOString(),
  status: "live",
};

await writeFile(
  new URL("../app/generated-dashboard-data.ts", import.meta.url),
  `import type { LiveDashboardData } from "./live-data";\n\nexport const generatedDashboardData = ${JSON.stringify(data)} as const satisfies LiveDashboardData;\n`,
  "utf8",
);

function formatDate(value) {
  if (!value) return "Dato mangler";
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(value));
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}
