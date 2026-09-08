const API_BASE = "https://api.ungapped.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export function sanitizeIssue(issue, statistics = issue) {
  const sent = number(statistics.SentCount);
  const recipients = number(statistics.RecipientCount);
  const failed = number(statistics.FailedCount);
  const bounced = number(statistics.BounceCount);
  const deliveryBase = recipients > 0 ? recipients : sent;
  const delivered = number(statistics.ReceivedCount) || Math.max(0, deliveryBase - failed - bounced);
  const opens = number(statistics.OpenCount);
  const clicks = number(statistics.ClickCount);

  return {
    id: text(issue.IssueId),
    name: text(issue.IssueName),
    subject: text(issue.Subject),
    sentAt: date(issue.Ended || issue.Started || issue.ScheduledForSending),
    delivered,
    uniqueOpens: opens,
    uniqueClicks: clicks,
    bounces: bounced,
    unsubscribes: number(statistics.UnsubscribeCount),
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
  if (issues.length > 0 && issues.every(issue => issue.delivered === 0))
    errors.push("Alle udsendelser mangler leveringstal");
  return [...new Set(errors)];
}

export async function fetchSentIssues(apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("UG_API er ikke konfigureret");
  const rawIssues = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("/Issues/SentList", API_BASE);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    const pageItems = await getJson(url, apiKey, fetchImpl);
    if (!Array.isArray(pageItems)) throw new Error("Uventet svarformat fra Ungapped");
    rawIssues.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;
  }

  return mapConcurrent(rawIssues, 4, async issue => {
    const id = text(issue.IssueId);
    if (!id) return sanitizeIssue(issue);
    const url = new URL(`/Issues/${id}/Statistics/Overview`, API_BASE);
    const statistics = await getJson(url, apiKey, fetchImpl);
    return sanitizeIssue(issue, statistics);
  });
}

async function getJson(url, apiKey, fetchImpl, attempt = 0) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { "x-api-key": apiKey, accept: "application/json" },
  });
  if ((response.status === 409 || response.status === 429) && attempt < 3) {
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    return getJson(url, apiKey, fetchImpl, attempt + 1);
  }
  if (!response.ok) throw new Error(`Ungapped svarede med HTTP ${response.status}`);
  return response.json();
}

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
