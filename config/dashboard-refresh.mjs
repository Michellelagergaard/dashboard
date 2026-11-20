export const dashboardRefreshIntervalMs = 5 * 60 * 1000;

// Only adopt a newer, compatible published snapshot. Failed requests and older
// CDN responses must never clear or roll back the data already on screen.
export function selectNewerDashboardData(current, payload) {
  if (payload?.schemaVersion !== 1 || !["live", "snapshot"].includes(payload.status)) return current;
  if (typeof payload.updatedAt !== "string" || !Number.isFinite(Date.parse(payload.updatedAt))) return current;
  const previousTime = Date.parse(current.updatedAt || "");
  if (Number.isFinite(previousTime) && Date.parse(payload.updatedAt) <= previousTime) return current;
  if (!Array.isArray(payload.mailings) || !payload.mailings.length || !payload.mailings.every(validMailing)) return current;
  return { mailings: payload.mailings, updatedAt: payload.updatedAt, status: payload.status };
}

function validMailing(mailing) {
  return mailing && ["id", "title", "subject", "type", "date"].every(key => typeof mailing[key] === "string")
    && (mailing.sentAt === null || typeof mailing.sentAt === "string")
    && ["delivered", "openRate", "clickRate", "unsubscribes"].every(key => Number.isFinite(mailing[key]))
    && ["content", "links", "segments"].every(key => Array.isArray(mailing[key]))
    && ["segmentPerformance", "segmentSubjects", "segmentLinkPerformance", "checkpoints", "editorialCatalog"]
      .every(key => mailing[key] === undefined || Array.isArray(mailing[key]));
}

export async function fetchDashboardSnapshot(url, { fetchImpl = fetch, signal } = {}) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set("refresh", String(Date.now()));
  const response = await fetchImpl(requestUrl.href, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Dashboard update unavailable");
  return response.json();
}
