import { mergeCorrections, validateCorrections } from "./editorial-content.mjs";

// Read-only compatibility: never migrate, rewrite or delete browser data.
// Keep the original string separately so even invalid files can be recovered.
export function resolveLegacyCorrections(shared, stored) {
  const fallback = { file: shared, localCount: 0, raw: null, error: "" };
  if (stored === null || stored === "") return fallback;
  if (stored === "unavailable") return { ...fallback, error: "Browserens gemte rettelser kunne ikke læses. Fælles rettelser vises; eventuelle lokale rettelser kan ikke anvendes, mens lagringen er blokeret." };
  try {
    const local = validateCorrections(JSON.parse(stored));
    return { file: mergeCorrections(shared, local), localCount: local.corrections.length, raw: stored, error: "" };
  } catch {
    return { ...fallback, raw: stored, error: "Gamle rettelser i denne browser kunne ikke læses og anvendes derfor ikke. De er ikke slettet. Gem en sikkerhedskopi, så de kan gennemgås." };
  }
}
