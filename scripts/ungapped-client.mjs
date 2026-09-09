import { memberSegmentField, memberSegments, minimumPublicSegmentSize } from "../config/member-segments.mjs";

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

  const tags = Array.isArray(issue.Tags)
    ? issue.Tags.map(tag => text(tag?.Name || tag?.TagName || tag)).filter(Boolean)
    : [];
  const sanitized = {
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
    tags,
    automated: Boolean(issue.Journey || issue.JourneyId),
  };
  const classificationMetadata = {
    apiCategory: extractLabels([issue.Category]),
    lists: extractLabels([issue.Lists]),
    segments: extractLabels([issue.Segments]),
  };
  const context = [
    ...classificationMetadata.apiCategory,
    ...classificationMetadata.lists,
    ...classificationMetadata.segments,
    ...extractLabels([issue.Journey]),
  ];
  const category = classifyIssue({ ...sanitized, context });
  const suggestedCategory = category === "Ikke kategoriseret"
    ? suggestCategory({ delivered, sentAt: sanitized.sentAt, apiCategory: classificationMetadata.apiCategory })
    : null;
  return {
    ...sanitized,
    classificationMetadata,
    category,
    categoryConfidence: category === "Ikke kategoriseret" ? null : "high",
    suggestedCategory,
    suggestionConfidence: suggestedCategory ? "medium" : null,
  };
}

export function suggestCategory(issue) {
  const isNewsletter = (issue.apiCategory || []).some(value => normalize(value) === "nyhedsbrev");
  if (!isNewsletter) return null;
  const sentAt = date(issue.sentAt);
  const weekday = sentAt ? new Date(sentAt).getUTCDay() : null;
  if (issue.delivered >= 12000 && weekday === 4) return "Psykologernes Nyhedsbrev";
  if (issue.delivered >= 12000 && weekday === 5) return "Magasinet P";
  if (issue.delivered >= 7000 && issue.delivered < 12000) return "Kompetencenyt";
  if (issue.delivered < 5000) return "Generel medlemskommunikation";
  return null;
}

export function classifyIssue(issue) {
  const haystack = normalize([issue.name, issue.subject, ...(issue.tags || []), ...(issue.context || [])].join(" "));
  if (/tomme ramme skabelon|walkth?orugh|walkthrough|tommelfinger op|tak for dit svar|\btest\b/.test(haystack))
    return "Test og systemmails";
  if (issue.automated || /strakskampagn|straksmail|automatisk sendes|bekræft venligst.*robot|blive endnu flere i fællesskabet|prøv 3 måneders gratis medlemskab|et nyt kapitel begynder.*velkommen/.test(haystack))
    return "Automatiske flows";
  if (/medlemsoplysninger/.test(haystack)) return "Generel medlemskommunikation";
  const rules = [
    ["Psykologernes Nyhedsbrev", [/psykologernes nyhedsbrev/, /psykolog nyt/]],
    ["TR/AMR Nyt", [/tr.?amr/, /tillidsrepræsentant/, /arbejdsmiljørepræsentant/]],
    ["Magasinet P", [
      /magasinet p/, /magasin p/, /nyhedsbrev(?:et)? fra p/, /nyheder fra p/,
      /p i denne uge/, /årets første nyhedsbrev fra p/,
    ]],
    ["Kompetencenyt", [
      /kompetencenyt/, /kompetence nyt/, /nye kurser/, /nye faglige tilbud/,
      /nye muligheder for din faglige udvikling/, /styrk din psykologfaglighed/,
      /nyt fra nationalt videnscenter.*kurser/, /gratis fyraftensmød/,
      /bliv fortrolig med supervisionsopgaven/, /styrk dine supervisor-kompetencer/,
    ]],
    ["Netværksnyt", [/netværksnyt/, /netværks nyt/]],
    ["Generel medlemskommunikation", [/medlemskommunikation/, /medlemsmail/, /medlemsinfo/, /gf27 invitation/]],
  ];
  for (const [category, patterns] of rules)
    if (patterns.some(pattern => pattern.test(haystack))) return category;
  return "Ikke kategoriseret";
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

export function extractLinkCatalog(html) {
  if (typeof html !== "string" || html.length === 0) return { links: [], excludedCount: 0 };
  const links = new Map();
  let excludedCount = 0;
  let position = 0;
  const hrefPattern = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1/gis;
  for (const match of html.matchAll(hrefPattern)) {
    position += 1;
    const destination = safeDestination(match[2]);
    if (!destination) {
      excludedCount += 1;
      continue;
    }
    const existing = links.get(destination);
    if (existing) existing.occurrences += 1;
    else links.set(destination, { destination, firstPosition: position, occurrences: 1 });
  }
  return { links: [...links.values()], excludedCount };
}

export async function fetchIssueLinkCatalog(apiKey, issueId, fetchImpl = fetch) {
  if (!apiKey) throw new Error("UG_API er ikke konfigureret");
  if (!text(issueId)) throw new Error("Udsendelses-id mangler");
  const issue = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}`, API_BASE), apiKey, fetchImpl);
  return extractLinkCatalog(issue.BodyHtml || issue.AutosavedHtml || "");
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

// Henter kun den samme aggregerede statistik, som vises i Ungappeds filtervisning.
// Ingen kontakter eller hændelser på personniveau hentes eller gemmes.
export async function fetchIssueSegmentPerformance(apiKey, issueId, fetchImpl = fetch) {
  const results = [];
  for (const segment of memberSegments) {
    const url = new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/Overview`, API_BASE);
    url.searchParams.set("contactFilter", contactFilter(segment.value));
    let statistics;
    try {
      statistics = await getJson(url, apiKey, fetchImpl);
    } catch (error) {
      return { available: false, results: [], reason: error instanceof Error ? error.message : "Ukendt API-fejl" };
    }
    const recipients = number(statistics.RecipientCount);
    const delivered = number(statistics.ReceivedCount) || Math.max(0, recipients - number(statistics.FailedCount) - number(statistics.BounceCount));
    if (recipients < minimumPublicSegmentSize || delivered < minimumPublicSegmentSize) continue;
    const opens = number(statistics.OpenCount);
    const clicks = number(statistics.ClickCount);
    results.push({
      name: segment.label,
      recipients,
      delivered,
      openRate: rate(opens, delivered),
      clickRate: rate(clicks, delivered),
      ctor: rate(clicks, opens),
      unsubscribes: number(statistics.UnsubscribeCount),
    });
  }
  return { available: true, results };
}

function contactFilter(value) {
  const escaped = String(value).replaceAll("'", "''");
  return `((${memberSegmentField} ne null and ${memberSegmentField} ne '' and indexof(${memberSegmentField}, '${escaped}') ge 0))`;
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

function normalize(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("da-DK");
}

function extractLabels(values) {
  const labels = [];
  const fields = ["Name", "Title", "Description", "CategoryName", "ListName", "SegmentName"];
  const seen = new Set();
  function visit(value, depth) {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") { labels.push(value); return; }
    if (typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    for (const field of fields) if (typeof value[field] === "string") labels.push(value[field]);
    for (const child of Object.values(value)) if (child && typeof child === "object") visit(child, depth + 1);
  }
  for (const value of values) visit(value, 0);
  return labels;
}

function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function rate(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null;
}

function safeDestination(rawHref) {
  const decoded = String(rawHref)
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .trim();
  if (!/^https?:\/\//i.test(decoded) || /\{[{%]|[%}]\}/.test(decoded)) return null;
  let url;
  try { url = new URL(decoded); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const sensitive = /(unsubscribe|afmeld|recipient|contact|email|token|signature|personal)/i;
  if (sensitive.test(`${url.hostname}${url.pathname}`)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.some(segment => /^[a-f0-9-]{24,}$/i.test(segment) || /^[A-Za-z0-9_-]{32,}$/.test(segment))) return null;
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}
