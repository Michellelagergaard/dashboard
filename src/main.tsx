import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Dashboard } from "../app/dashboard";
import { generatedDashboardData } from "../app/generated-dashboard-data";
import type { LiveDashboardData } from "../app/live-data";
import { dashboardRefreshIntervalMs, fetchDashboardSnapshot, selectNewerDashboardData } from "../config/dashboard-refresh.mjs";
import "../app/globals.css";

function DashboardApp() {
  const [data, setData] = useState<LiveDashboardData>(generatedDashboardData);

  useEffect(() => {
    let disposed = false;
    let request: AbortController | null = null;
    const url = new URL("./dashboard-data.json", document.baseURI);
    async function refresh() {
      if (document.hidden || request || disposed) return;
      const controller = new AbortController();
      request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const payload = await fetchDashboardSnapshot(url, { signal: controller.signal });
        if (!disposed) setData(current => selectNewerDashboardData(current, payload));
      } catch {
        // Keep the last good snapshot offline or during a failed publication.
      } finally {
        window.clearTimeout(timeout);
        request = null;
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, dashboardRefreshIntervalMs);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      request?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Update props without remounting the dashboard: selections and open panels stay.
  return <Dashboard liveData={data} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
