import React from "react";
import ReactDOM from "react-dom/client";
import { Dashboard } from "../app/dashboard";
import { realSnapshot } from "../app/real-snapshot";
import "../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard liveData={{
      mailings: realSnapshot.mailings,
      updatedAt: realSnapshot.generatedAt,
      status: "snapshot",
    }} />
  </React.StrictMode>,
);
