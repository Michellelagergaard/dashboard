const dispatchUrl = "https://api.github.com/repos/Michellelagergaard/dashboard/actions/workflows/pages.yml/dispatches";

// The Ungapped credential remains in GitHub; this worker only starts the existing workflow.
export async function dispatchRefresh(env, request = fetch) {
  if (!env.GITHUB_ACTIONS_TOKEN) throw new Error("GITHUB_ACTIONS_TOKEN is not configured.");
  let response;
  try {
    response = await request(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_ACTIONS_TOKEN}`,
        "User-Agent": "dashboard-hourly-refresh",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Do not include request objects, credentials, or upstream error bodies in logs.
    throw new Error("GitHub dispatch request failed or timed out; check Actions before retrying.");
  }
  if (!response.ok) throw new Error(`GitHub dispatch failed (HTTP ${response.status}).`);
}

export default {
  async scheduled(_controller, env) {
    await dispatchRefresh(env);
    console.log("Hourly dashboard update requested; completion is recorded in GitHub Actions.");
  },
};
