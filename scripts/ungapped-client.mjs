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
  return { ...sanitized, classificationMetadata, category: classifyIssue({ ...sanitized, context }) };
}

export function classifyIssue(issue) {
  const haystack = normalize([issue.name, issue.subject, ...(issue.tags || []), ...(issue.context || [])].join(" "));
  if (/tomme ramme skabelon|walkthrough|tommelfinger op|tak for dit svar|\btest\b/.test(haystack))
    return "Test og systemmails";
  if (issue.automated || /strakskampagn|straksmail|automatisk sendes|bekræft venligst.*robot/.test(haystack))
    return "Automatiske flows";
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
