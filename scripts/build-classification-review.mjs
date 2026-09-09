import { writeFile } from "node:fs/promises";
import { fetchIssueLinkCatalog, fetchSentIssues } from "./ungapped-client.mjs";
import { memberSegmentField, memberSegmentFieldLabel, memberSegments, minimumPublicSegmentSize } from "../config/member-segments.mjs";

const issues = await fetchSentIssues(process.env.UG_API);
const analysis = await mapConcurrent(issues, 4, async issue => {
  const linkCatalog = await fetchIssueLinkCatalog(process.env.UG_API, issue.id);
  return {
    id: issue.id,
    name: issue.name,
    subject: issue.subject,
    sentAt: issue.sentAt,
    category: issue.category,
    suggestedCategory: issue.suggestedCategory,
    suggestionConfidence: issue.suggestionConfidence,
    apiCategory: issue.classificationMetadata.apiCategory,
    lists: issue.classificationMetadata.lists,
    segments: issue.classificationMetadata.segments,
    delivered: issue.delivered,
    uniqueOpens: issue.uniqueOpens,
    uniqueClicks: issue.uniqueClicks,
    links: linkCatalog.links,
    excludedLinkCount: linkCatalog.excludedCount,
    linkClickDataAvailable: false,
    segmentPerformanceDataAvailable: false,
  };
});
const review = issues
  .filter(issue => issue.category === "Ikke kategoriseret")
  .map(issue => ({
    id: issue.id,
    name: issue.name,
    subject: issue.subject,
    sentAt: issue.sentAt,
    tags: issue.tags,
    automated: issue.automated,
    apiCategory: issue.classificationMetadata.apiCategory,
    lists: issue.classificationMetadata.lists,
    segments: issue.classificationMetadata.segments,
    delivered: issue.delivered,
  }));

await writeFile("classification-review.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalIssues: issues.length,
  reviewCount: review.length,
  methodology: {
    linkCatalog: "Destinations found in issue HTML; query strings, fragments, unsubscribe links and possible personal tokens are excluded.",
    linkClicks: "Ungapped API does not document clicks per link. Catalog presence must not be interpreted as a click.",
    segments: `Segment performance must be based on ${memberSegmentFieldLabel} (${memberSegmentField}) and the centrally maintained mapping. Only aggregate groups of at least ${minimumPublicSegmentSize} recipients may be published. No performance is inferred without documented aggregate API data.`,
  },
  memberSegmentMapping: {
    field: memberSegmentField,
    fieldLabel: memberSegmentFieldLabel,
    minimumPublicSegmentSize,
    segments: memberSegments,
  },
  analysis,
  issues: review,
}, null, 2));

console.log(JSON.stringify({
  status: "ok",
  issueCount: analysis.length,
  reviewCount: review.length,
  catalogedLinkCount: analysis.reduce((sum, issue) => sum + issue.links.length, 0),
  excludedLinkCount: analysis.reduce((sum, issue) => sum + issue.excludedLinkCount, 0),
}));

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}
