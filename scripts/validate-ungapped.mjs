import { fetchSentIssues, validateIssues } from "./ungapped-client.mjs";

const issues = await fetchSentIssues(process.env.UG_API);
const errors = validateIssues(issues);

if (errors.length) {
  console.error(`Datakontrol fejlede med ${errors.length} fejltyper.`);
  process.exit(1);
}

const newest = issues.map(issue => issue.sentAt).filter(Boolean).sort().at(-1) ?? null;

console.log(JSON.stringify({
  status: "ok",
  issueCount: issues.length,
  newest,
  checkedAt: new Date().toISOString(),
}));
