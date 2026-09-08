import { writeFile } from "node:fs/promises";
import { fetchSentIssues } from "./ungapped-client.mjs";

const issues = await fetchSentIssues(process.env.UG_API);
const review = issues
  .filter(issue => issue.category === "Ikke kategoriseret")
  .map(issue => ({
    id: issue.id,
    name: issue.name,
    subject: issue.subject,
    sentAt: issue.sentAt,
    tags: issue.tags,
    automated: issue.automated,
  }));

await writeFile("classification-review.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalIssues: issues.length,
  reviewCount: review.length,
  issues: review,
}, null, 2));

console.log(JSON.stringify({ status: "ok", reviewCount: review.length }));
