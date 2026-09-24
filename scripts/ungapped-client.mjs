import { memberSegmentField, memberSegments, minimumPublicSegmentSize } from "../config/member-segments.mjs";
import { measurementVersion } from "../config/measurement-methods.mjs";
import { extractEditorialCatalog } from "./editorial-catalog.mjs";

const API_BASE = "https://api.ungapped.com";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
let resolvedLinkStatisticsPath;

export function sanitizeIssue(issue, statistics = issue) {
  const sent = number(statistics.SentCount);
  const recipients = number(statistics.RecipientCount);
  const failed = number(statistics.FailedCount);
  const bounced = number(statistics.BounceCount);
  const deliveryBase = recipients > 0 ? recipients : sent;
  const delivered = finiteCount(statistics.ReceivedCount) ?? Math.max(0, deliveryBase - failed - bounced);
  const opens = number(statistics.OpenCount);
  const clicks = number(statistics.ClickCount);

  // Ungapped kan returnere samme tag med forskellige feltnavne afhængigt af
  // udsendelsestype og API-version. Vi læser kun taggets visningsnavn.
  const tags = Array.isArray(issue.Tags)
    ? issue.Tags.map(tag => text(tag?.Name || tag?.TagName || tag?.Title || tag?.Description || tag)).filter(Boolean)
    : [];
  const sanitized = {
    id: text(issue.IssueId),
    name: text(issue.IssueName),
    subject: text(issue.Subject),
    sentAt: date(issue.Ended || issue.Started || issue.ScheduledForSending),
    delivered,
    recipients,
    measurementVersion,
    measurement: { overviewSource: "Statistics/Overview", openSource: "OpenCount", clickSource: "ClickCount", denominator: "delivered", deliverySource: finiteCount(statistics.ReceivedCount) !== null ? "ReceivedCount" : "recipient-minus-failed-and-bounced", uniqueness: "not-verified" },
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
  const anchorPattern = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gis;
  for (const match of html.matchAll(anchorPattern)) {
    position += 1;
    const destination = safeDestination(match[2]);
    if (!destination) {
      excludedCount += 1;
      continue;
    }
    const title = extractLinkTitle(match[3]);
    const existing = links.get(destination);
    if (existing) {
      existing.occurrences += 1;
      existing.title = preferLinkTitle(existing.title, title);
    } else {
      links.set(destination, { title, destination, firstPosition: position, occurrences: 1 });
    }
  }
  return { links: [...links.values()], excludedCount };
}

function extractLinkTitle(innerHtml) {
  const imageAlt = [...String(innerHtml).matchAll(/<img\b[^>]*?\balt\s*=\s*(["'])(.*?)\1/gi)]
    .map((match) => cleanLinkTitle(match[2]))
    .find(Boolean);
  const visibleText = cleanLinkTitle(String(innerHtml)
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " "));
  return preferLinkTitle(imageAlt, visibleText);
}

function cleanLinkTitle(value) {
  const cleaned = decodeHtmlEntities(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!cleaned || /^https?:\/\//i.test(cleaned) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(cleaned)) return "";
  return cleaned;
}

function preferLinkTitle(current, candidate) {
  const values = [current, candidate].filter(Boolean);
  return values.sort((a, b) => linkTitleScore(b) - linkTitleScore(a))[0] || "";
}

function linkTitleScore(value) {
  const generic = /^(læs|læs mere|se mere|klik her|tilmeld|tilmeld dig|gå til|åbn|her)$/i.test(value);
  return (generic ? 0 : 1000) + Math.min(value.length, 160);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;|&#60;/gi, "<")
    .replace(/&gt;|&#62;/gi, ">");
}

export async function fetchIssueLinkCatalog(apiKey, issueId, fetchImpl = fetch) {
  if (!apiKey) throw new Error("UG_API er ikke konfigureret");
  if (!text(issueId)) throw new Error("Udsendelses-id mangler");
  const issue = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}`, API_BASE), apiKey, fetchImpl);
  return extractLinkCatalog(issue.BodyHtml || issue.AutosavedHtml || "");
}

export async function fetchIssueEditorialCatalog(apiKey, issueId, fetchImpl = fetch) {
  if (!apiKey || !text(issueId)) throw new Error("API-adgang eller udsendelses-id mangler");
  const issue = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}`, API_BASE), apiKey, fetchImpl);
  // Draft/autosave HTML is not evidence of what was sent.
  if (!issue.BodyHtml) throw new Error("Den sendte HTML mangler");
  return extractEditorialCatalog(issue.BodyHtml, safeDestination);
}


// Dynamiske emnelinjer er en del af selve udsendelsesopsætningen. I DP's
// nyhedsbrev styres de af sektioner / Contact.Custom3, medlemskab /
// Contact.CustomLong1 og Har ydernummer / Contact.CustomLong2. Kun regel og emnelinje
// hentes; ingen kontakter eller individuelle modtagerdata indgår.
export async function fetchIssueSegmentSubjects(apiKey, issueId, fetchImpl = fetch) {
  if (!apiKey) throw new Error("UG_API er ikke konfigureret");
  if (!text(issueId)) throw new Error("Udsendelses-id mangler");
  const issue = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}`, API_BASE), apiKey, fetchImpl);
  return extractSegmentSubjects(issue);
}

export function extractSegmentSubjects(issue) {
  const template = text(issue?.DynamicSubject);
  if (!template) return [];

  const output = new Map();
  const blockPattern = /{{#([^}]*)}}([\s\S]*?)(?={{[#/]|$)/g;

  for (const match of template.matchAll(blockPattern)) {
    const condition = normalize(match[1]);
    const subject = cleanDynamicSubject(match[2]);
    if (!subject) continue;

    for (const segment of memberSegments) {
      const matchesMembership = condition.includes(normalize(segment.value))
        && condition.includes(normalize(`Contact.${segment.field || memberSegmentField}`));
      if (matchesMembership) output.set(segment.label, subject);
    }
  }

  return [...output.entries()].map(([audience, subject]) => ({ audience, subject }));
}

function cleanDynamicSubject(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
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
    return { ...sanitizeIssue(issue, statistics), fetchedAt: new Date().toISOString() };
  });
}

// Henter kun den samme aggregerede statistik, som vises i Ungappeds filtervisning.
// Ingen kontakter eller hændelser på personniveau hentes eller gemmes.
export async function fetchIssueSegmentPerformance(apiKey, issueId, fetchImpl = fetch, segments = memberSegments) {
  const baselineUrl = new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/Overview`, API_BASE);
  let baseline;
  try {
    baseline = await getJson(baselineUrl, apiKey, fetchImpl);
  } catch (error) {
    return { available: false, results: [], reason: error instanceof Error ? error.message : "Ukendt API-fejl" };
  }
  const baselineRecipients = number(baseline.RecipientCount);
  const results = [];
  for (const segment of segments) {
    const url = new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/Overview`, API_BASE);
    url.searchParams.set("contactFilter", contactFilter(segment));
    let statistics;
    try {
      statistics = await getJson(url, apiKey, fetchImpl);
    } catch (error) {
      return { available: false, results, reason: error instanceof Error ? error.message : "Ukendt API-fejl" };
    }
    const recipients = number(statistics.RecipientCount);
    const delivered = finiteCount(statistics.ReceivedCount) ?? Math.max(0, recipients - number(statistics.FailedCount) - number(statistics.BounceCount));
    // Hvis API'et ignorerer kontaktfilteret, returnerer det udsendelsens
    // samlede tal. De må aldrig præsenteres som et segmentresultat.
    if (baselineRecipients > minimumPublicSegmentSize && recipients >= baselineRecipients) continue;
    if (recipients < minimumPublicSegmentSize || delivered < minimumPublicSegmentSize) continue;
    const opens = number(statistics.OpenCount);
    const clicks = number(statistics.ClickCount);
    results.push({
      name: segment.label,
      recipients,
      delivered,
      measurementVersion,
      membershipTimeBasis: "not-verified",
      openRate: rate(opens, delivered),
      clickRate: rate(clicks, delivered),
      ctor: rate(clicks, opens),
      unsubscribes: number(statistics.UnsubscribeCount),
    });
  }
  return { available: true, results };
}

// Linkstatistik behandles kun som aggregerede rækker fra Ungappeds
// dokumenterede /Statistics/Links-visning. Svar valideres, før de må blive
// en del af den offentlige datasamling.
export async function fetchIssueSegmentLinkPerformance(apiKey, issueId, fetchImpl = fetch) {
  return (await fetchIssueSegmentLinkData(apiKey, issueId, fetchImpl)).results;
}

export async function fetchIssueSegmentLinkData(apiKey, issueId, fetchImpl = fetch, segments = memberSegments) {
  const baseline = await fetchIssueLinkStatistics(apiKey, issueId, null, fetchImpl);
  if (!baseline.available) return { available: false, results: [] };
  const output = [];
  let available = true;
  for (const segment of segments) {
    const result = await fetchIssueLinkStatistics(apiKey, issueId, contactFilter(segment), fetchImpl);
    if (!result.available) available = false;
    // Et uændret resultat betyder, at kontaktfilteret sandsynligvis blev
    // ignoreret. Det må aldrig udgives som et segmentresultat.
    if (!result.available || sameLinkResults(baseline.results, result.results)) continue;
    for (const item of result.results) {
      if (item.clicks < minimumPublicSegmentSize) continue;
      output.push({ ...item, audience: segment.label });
    }
  }
  return { available, results: output };
}

export async function fetchIssueLinkPerformance(apiKey, issueId, fetchImpl = fetch) {
  return fetchIssueLinkStatistics(apiKey, issueId, null, fetchImpl);
}

async function fetchIssueLinkStatistics(apiKey, issueId, filter, fetchImpl) {
  const candidates = ["Links"];
  const paths = resolvedLinkStatisticsPath ? [resolvedLinkStatisticsPath] : candidates;
  for (const name of paths) {
    const url = new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/${name}`, API_BASE);
    if (filter) url.searchParams.set("contactFilter", filter);
    try {
      // Links-endpointet har en lavere forespørgselsgrænse end oversigten.
      // Et kort interval gør timekørslen stabil og undgår tomme klikrækker.
      await pause(1250);
      const raw = await getJson(url, apiKey, fetchImpl);
      const results = reduceLinkStatistics(raw);
      if (results.length || Array.isArray(raw) && raw.length === 0) {
        resolvedLinkStatisticsPath = name;
        return { available: true, results };
      }
    } catch {
      // Ikke alle Ungapped-konti udstiller alle statistikvisninger i API'et.
    }
  }
  return { available: false, results: [] };
}

function sameLinkResults(a, b) {
  if (a.length !== b.length) return false;
  const key = item => `${item.destination}|${item.clicks}`;
  return [...a].map(key).sort().every((value, index) => value === [...b].map(key).sort()[index]);
}

export function reduceLinkStatistics(raw) {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? [raw.Items, raw.Results, raw.Links, raw.Value, raw.value].find(Array.isArray) || []
      : [];
  const rows = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const destination = safeDestination(item.Url || item.URL || item.Link || item.Destination || item.Href || item.TargetUrl);
    // Ungappeds Links-statistik dokumenterer ContactCount som antallet af
    // unikke kontakter, der har klikket. ClickCount er samlede klik og må ikke
    // vises som unikke klik.
    const uniqueSource = ["ContactCount", "UniqueClicks", "UniqueClickCount", "UniqueClick"].find(field => finiteCount(item[field]) !== null);
    const totalSource = ["ClickCount", "Clicks"].find(field => finiteCount(item[field]) !== null);
    const source = uniqueSource || totalSource;
    if (!destination || !source) continue;
    const clicks = finiteCount(item[source]);
    const metric = uniqueSource ? "unique-contacts" : "total-clicks";
    const existing = rows.get(destination);
    // Samme destination kan ligge bag fx overskrift, billede og knap. Summen
    // kan dobbelt-tælle personer, så vi bevarer det højeste dokumenterede
    // antal unikke kontakter for destinationen.
    if (!existing) {
      rows.set(destination, { title: destination, destination, clicks, rate: 0, clickMeasurement: { metric, source, aggregation: "single-link", sourceRows: 1 } });
    } else {
      // Do not compare an event count to a unique-contact count. Prefer the
      // documented contact measurement, retaining the number of source rows.
      const replace = metric === existing.clickMeasurement.metric ? clicks > existing.clicks : metric === "unique-contacts";
      const previousRows = existing.clickMeasurement.sourceRows;
      if (replace) { existing.clicks = clicks; existing.clickMeasurement = { metric, source }; }
      existing.clickMeasurement.aggregation = "max-per-destination";
      existing.clickMeasurement.sourceRows = previousRows + 1;
    }
  }
  return [...rows.values()].filter(row => row.clicks > 0);
}

function finiteCount(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function contactFilter(segment) {
  const escaped = String(segment.value).replaceAll("'", "''");
  const field = segment.field || memberSegmentField;
  return `((${field} ne null and ${field} ne '' and indexof(${field}, '${escaped}') ge 0))`;
}

async function getJson(url, apiKey, fetchImpl, attempt = 0) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { "x-api-key": apiKey, accept: "application/json" },
  });
  if ((response.status === 409 || response.status === 429) && attempt < 5) {
    await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1)));
    return getJson(url, apiKey, fetchImpl, attempt + 1);
  }
  if (!response.ok) throw new Error(`Ungapped svarede med HTTP ${response.status}`);
  return response.json();
}

function pause(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
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
  // Bevar menneskeligt læsbare slugs som
  // "familieterapi-teori-og-intervention-403313". Den tidligere brede regel
  // behandlede alle lange slugs som mulige personlige tokens og fjernede derfor
  // legitime kursuslinks fra statistikken. UUID-/hex-id'er og lange, udelte
  // tokens bliver fortsat afvist.
  if (segments.some(segment => /^[a-f0-9-]{24,}$/i.test(segment) || /^[A-Za-z0-9_]{32,}$/.test(segment))) return null;
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}
