const API_BASE = "https://api.ungapped.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export function sanitizeIssue(issue) {
  const sent = number(issue.SentCount);
  const recipients = number(issue.RecipientCount);
  const failed = number(issue.FailedCount);
  const bounced = number(issue.BounceCount);
  const deliveryBase = recipients > 0 ? recipients : sent;
  const delivered = Math.max(0, deliveryBase - failed - bounced);
  const opens = number(issue.OpenCount);
  const clicks = number(issue.ClickCount);

  return {
    id: text(issue.IssueId),
    name: text(issue.IssueName),
    subject: text(issue.Subject),
    sentAt: date(issue.Ended || issue.Started || issue.ScheduledForSending),
    delivered,
    uniqueOpens: opens,
    uniqueClicks: clicks,
    bounces: bounced,
    unsubscribes: number(issue.UnsubscribeCount),
    openRate: rate(opens, delivered),
    clickRate: rate(clicks, delivered),
    tags: Array.isArray(issue.Tags)
      ? issue.Tags.map(tag => text(tag?.Name || tag?.TagName || tag)).filter(Boolean)
      : [],
  };
}

export function validateIssues(issues) {
  const errors = [];
  const ids = new Set();
  for (const issue of issues) {
    if (!issue.id) errors.push("Udsendelse mangler id");
    if (issue.id && ids.has(issue.id)) errors.push("Dubleret udsendelses-id");
    ids.add(issue.id);
    for (const field of ["delivered", "uniqueOpens", "uniqueClicks", "bounces", "unsubscribes"])
      if (!Number.isFinite(issue[field]) || issue[field] < 0) errors.push(`Ugyldig værdi i ${field}`);
  }
  return [...new Set(errors)];
}

export async function fetchSentIssues(apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("UG_API er ikke konfigureret");
  const results = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("/Issues/SentList", API_BASE);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "x-api-key": apiKey, accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Ungapped svarede med HTTP ${response.status}`);
    const pageItems = await response.json();
    if (!Array.isArray(pageItems)) throw new Error("Uventet svarformat fra Ungapped");
    results.push(...pageItems.map(sanitizeIssue));
    if (pageItems.length < PAGE_SIZE) break;
  }

  return results;
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function rate(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null;
}
