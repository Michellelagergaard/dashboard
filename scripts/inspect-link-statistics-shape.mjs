const apiKey = process.env.UG_API;
if (!apiKey) throw new Error("UG_API mangler.");

const base = "https://api.ungapped.com";
const sent = await getJson(new URL("/Issues/SentList?page=0&pageSize=1", base));
const issueId = sent?.[0]?.IssueId;
if (!issueId) throw new Error("Ingen udsendelse fundet.");

const response = await getJson(new URL(`/Issues/${encodeURIComponent(issueId)}/Statistics/Links`, base));
const first = firstObject(response);

// Log kun datastruktur: ingen titler, URL'er, kontaktdata eller talværdier.
console.log(JSON.stringify({
  responseKind: Array.isArray(response) ? "array" : typeof response,
  topLevelKeys: objectKeys(response),
  rowKeys: objectKeys(first),
  nestedArrayKeys: nestedArrayKeys(response),
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
