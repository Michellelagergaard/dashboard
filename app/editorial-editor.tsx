"use client";
import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { contentKinds, correctionKey, correctionStorageKey, mergeCorrections, validateCorrections } from "../config/editorial-content.mjs";
import { editorialTopicNames } from "../config/editorial-topics.mjs";
import sharedFile from "../config/editorial-overrides.json";
import type { EditorialMetadata } from "./live-data";

type Correction = { mailingId: string; destination: string; title: string; kind: string; category: string };
type CorrectionFile = { version: number; corrections: Correction[] };
const shared = validateCorrections(sharedFile) as CorrectionFile;
const empty: CorrectionFile = { version: 1, corrections: [] };
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dp-editorial-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("dp-editorial-change", callback); };
}
function storageSnapshot() { try { return localStorage.getItem(correctionStorageKey) || ""; } catch { return "unavailable"; } }
const Context = createContext<{ save: (row: Correction) => boolean; reset: (row: Correction) => void; ready: boolean; local: Correction[] }>({ save: () => false, reset: () => {}, ready: false, local: [] });

export function EditorialProvider({ children }: { children: (file: CorrectionFile) => ReactNode }) {
  const stored = useSyncExternalStore(subscribe, storageSnapshot, () => null);
  const ready = stored !== null;
  const [message, setMessage] = useState("");
  const { local, readError } = useMemo(() => {
    try { return { local: stored ? validateCorrections(JSON.parse(stored)) as CorrectionFile : empty, readError: "" }; }
    catch { return { local: empty, readError: "Gemte rettelser kunne ikke læses. De er ikke overskrevet. Browserens lagring kan være blokeret, eller rettelsesfilen kan være beskadiget." }; }
  }, [stored]);
  const combined = mergeCorrections(shared, local) as CorrectionFile;
  function persist(file: CorrectionFile) {
    try { const valid = validateCorrections(file); localStorage.setItem(correctionStorageKey, JSON.stringify(valid)); window.dispatchEvent(new Event("dp-editorial-change")); setMessage("Rettelsen er gemt i denne browser. Del rettelsesfilen for at bruge den hos kolleger."); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Rettelsen kunne ikke gemmes."); return false; }
  }
  function save(row: Correction) { return persist(mergeCorrections(local, { version: 1, corrections: [row] })); }
  function reset(row: Correction) { persist({ version: 1, corrections: local.corrections.filter(item => correctionKey(item.mailingId,item.destination) !== correctionKey(row.mailingId,row.destination)) }); }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(combined, null, 2) + "\n"], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "editorial-overrides.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) { setMessage("Filen er for stor. Vælg en rettelsesfil på højst 2 MB."); return; }
    try { const imported = validateCorrections(JSON.parse(await file.text())); persist(mergeCorrections(local, imported)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Filen kunne ikke læses."); }
  }
  return <Context.Provider value={{ save, reset, ready, local: local.corrections }}>
    {children(combined)}
    <details className="editorial-sharing"><summary>Del og gem redaktionelle rettelser · {local.corrections.length} lokale</summary>
      {readError ? <p role="alert">{readError}</p> : null}
      <p>Brug “Ret indhold” ved en historie. Rettelsen gælder samme link i samme udsendelse, også i målgruppevisningen. Målingerne ændres ikke.</p>
      <p><strong>Rettelser gemmes i denne browser.</strong> Kolleger kan importere filen. Fælles rettelser til alle brugere kræver, at filen gemmes i repositoryet; GitHub kræver skriveadgang.</p>
      <div className="editorial-actions"><button type="button" onClick={download} disabled={!ready}>Eksportér rettelsesfil</button><label className="file-label">Importér rettelsesfil<input type="file" accept="application/json,.json" disabled={!ready} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></label><a href="https://github.com/Michellelagergaard/dashboard/edit/main/config/editorial-overrides.json" target="_blank" rel="noreferrer">Åbn fælles rettelser i GitHub</a></div>
      <p>Til fælles brug: Eksportér filen, erstat indholdet i GitHub-filen med rettelsesfilens indhold, og gem ændringen. Import overskriver kun rettelser til de samme links; andre rettelser bevares. En lokal rettelse har forrang for en fælles rettelse.</p>
    </details>
    {message ? <div className="editorial-message" role="status">{message}<button type="button" onClick={() => setMessage("")} aria-label="Luk besked">Luk</button></div> : null}
  </Context.Provider>;
}

export function ContentEditor({ destination, editorial }: { destination: string; editorial?: EditorialMetadata }) {
  const context = useContext(Context);
  const [opened, setOpened] = useState(false);
  if (!editorial) return null;
  const hasLocal = context.local.some(row => row.mailingId === editorial.mailingId && row.destination === destination);
  return <div className="content-editor"><button type="button" className="row-link" aria-expanded={opened} onClick={() => setOpened(!opened)}>{opened ? "Luk rettelse" : "Ret indhold"}</button>{opened ? <form key={`${editorial.title}-${editorial.kind}-${editorial.category}`} onSubmit={event => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    if (context.save({ mailingId: editorial.mailingId, destination, title: String(values.get("title")), kind: String(values.get("kind")), category: String(values.get("category")) })) setOpened(false);
  }}><label>Overskrift<input name="title" defaultValue={editorial.title} required maxLength={220} /></label><label>Indholdstype<select name="kind" defaultValue={editorial.kind}>{Object.entries(contentKinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Emne<select name="category" defaultValue={editorial.category}>{editorialTopicNames.map(value => <option key={value}>{value}</option>)}</select></label><p>Gemmes lokalt i denne browser. Brug deling nederst på siden til kolleger.</p><button type="submit" disabled={!context.ready}>Gem rettelse</button>{hasLocal ? <button type="button" onClick={() => { context.reset({ ...editorial, destination }); setOpened(false); }}>Fjern lokal rettelse</button> : null}</form> : null}</div>;
}
