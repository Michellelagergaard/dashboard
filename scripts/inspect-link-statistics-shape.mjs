const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const base = "https://api.ungapped.com";
const sent = await getJson(new URL("/Issues/SentList?page=0&pageSize=100", base));
const target = sent.find(issue => String(issue.IssueName || issue.Subject || "").includes("46 ledige ydernumre")) || sent?.[0];
const issueId = target?.IssueId;
if (!issueId) throw new Error("Ingen udsendelse fundet.");

const response = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/Links`, base));
const rows = Array.isArray(response) ? response.filter(value => value && typeof value === "object") : [];
const first = rows[0] || firstObject(response);

// Log kun struktur og optællinger: ingen titler, URL'er, kontaktdata eller talværdier.
console.log(JSON.stringify({
  responseKind: Array.isArray(response) ? "array" : typeof response,
  topLevelKeys: objectKeys(response),
  rowKeys: objectKeys(first),
  nestedArrayKeys: nestedArrayKeys(response),
  rowCount: rows.length,
  urlValueType: typeof first?.Url,
  clickCountValueType: typeof first?.ClickCount,
  contactCountValueType: typeof first?.ContactCount,
  rowsWithPublicClicks: rows.filter(row => Number(row.ContactCount) >= 5).length,
  rowsWithPublicTotalClicks: rows.filter(row => Number(row.ClickCount) >= 5).length,
  rowsWithHttpUrl: rows.filter(row => typeof row.Url === "string" && /^https?:\/\//i.test(row.Url)).length,
  rowsPassingPublicationSafety: rows.filter(row => safeDestination(row.Url)).length,
}, null, 2));

async function getJson(url) {
  const result = await fetch(url, { headers: { "x-api-key": apiKey, accept: "application/json" } });
  if (!result.ok) throw new Error(`Ungapped svarede med HTTP ${result.status}`);
  return result.json();
}
function objectKeys(value) { return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : []; }
function firstObject(value) {
  if (Array.isArray(value)) return value.find(item => item && typeof item === "object") || null;
  if (!value || typeof value !== "object") return null;
  for (const child of Object.values(value)) if (Array.isArray(child)) return child.find(item => item && typeof item === "object") || null;
  return null;
}
function nestedArrayKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).filter(([, child]) => Array.isArray(child)).map(([key]) => key).sort();
}

function safeDestination(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return !/(unsubscribe|afmeld|recipient|contact|email|token|signature|personal)/i.test(`${url.hostname}${url.pathname}`);
  } catch { return false; }
}

function safeDestination(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return !/(unsubscribe|afmeld|recipient|contact|email|token|signature|personal)/i.test(`${url.hostname}${url.pathname}`); } catch { return false; }
}
