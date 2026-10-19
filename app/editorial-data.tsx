"use client";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { correctionStorageKey, validateCorrections } from "../config/editorial-content.mjs";
import { resolveLegacyCorrections } from "../config/legacy-corrections.mjs";
import sharedFile from "../config/editorial-overrides.json";

type CorrectionFile = ReturnType<typeof validateCorrections>;
const shared = validateCorrections(sharedFile);
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function storageSnapshot() {
  try { return localStorage.getItem(correctionStorageKey) || ""; }
  catch { return undefined; }
}

export function EditorialData({ children }: { children: (file: CorrectionFile) => ReactNode }) {
  const stored = useSyncExternalStore(subscribe, storageSnapshot, () => null);
  const { file, localCount, raw, error } = useMemo(() => resolveLegacyCorrections(shared, stored), [stored]);
  return <>{children(file)}<LegacyCorrectionNotice localCount={localCount} raw={raw} error={error} /></>;
}

// Only browsers with legacy data (or blocked storage) see recovery controls.
export function LegacyCorrectionNotice({ localCount, raw, error }: { localCount: number; raw: string | null; error: string }) {
  const [message, setMessage] = useState("");
  if (!localCount && !error) return null;
  function backup() {
    if (raw === null) return;
    try {
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "editorial-local-backup.json";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Sikkerhedskopien er sendt til download. Kontrollér, at filen er gemt, før du sletter browserdata.");
    } catch { setMessage("Sikkerhedskopien kunne ikke hentes. Bevar browserdata, og prøv igen."); }
  }
  return <aside className="legacy-corrections" aria-label="Gamle lokale rettelser">
    <h2>Gamle rettelser i denne browser</h2>
    {error ? <p role="alert">{error}</p> : <p>{localCount} lokale rettelser bruges stadig i visningerne. De har forrang for fælles rettelser og følger ikke med, når du deler et dashboardlink. Manuel redigering er afviklet.</p>}
    {raw !== null ? <><p>Gem en sikkerhedskopi før sletning af browserdata. Fælles rettelser er bevaret.</p><button type="button" onClick={backup}>Hent sikkerhedskopi af gamle rettelser</button></> : null}
    {message ? <p role="status">{message}</p> : null}
  </aside>;
}
