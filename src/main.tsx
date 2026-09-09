import React from "react";
import ReactDOM from "react-dom/client";
import { Dashboard } from "../app/dashboard";
import { generatedDashboardData } from "../app/generated-dashboard-data";
import "../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard liveData={{
      ...generatedDashboardData,
    }} />
  </React.StrictMode>,
);
