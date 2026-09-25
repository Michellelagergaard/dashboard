import { editorialCategory, editorialTopicNames } from "./editorial-topics.mjs";

export const contentKinds = { news: "Nyheder og fagligt indhold", service: "Servicelinks", unknown: "Til gennemgang" };
export const correctionKey = (mailingId, destination) => JSON.stringify([mailingId, destination]);
export const correctionStorageKey = "dp-editorial-corrections-v1";

export function classifyContent(item) {
  let url;
  try { url = new URL(item.destination); } catch { return "unknown"; }
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  // Explicit navigation/utility destinations only. A social post is not a profile link.
  if (host === "mitdp.dk" || (/^(dp\.dk|psykologjob\.dk|psykologeridanmark\.dk)$/.test(host) && !path)
    || (host === "dp.dk" && /^\/(medlemskab\/medlemsfordele(?:\/kontante-fordele)?|uddannelse-og-karriere\/kurser-og-arrangementer|netvaerk-og-job\/karriere)$/.test(path))
    || (/^(facebook\.com|instagram\.com|linkedin\.com)$/.test(host) && !/\/(posts|feed\/update|reel|p)\//.test(path))) return "service";
  // Generic job URL may represent several advertisements after tracking parameters
  // were removed. Keep it visible for review instead of inventing one article.
  if (host === "psykologjob.dk" && path === "/job") return "unknown";
  if (item.ambiguous) return "unknown";
  if (["heading", "styled-heading"].includes(item.titleSource)) return "news";
  if (host === "dp.dk" && /^\/(nyheder|fag-og-politik|raadgivning)\/.+/.test(path)) return "news";
  return "unknown";
}

export function validateCorrections(input) {
  if (input?.version !== 1 || !Array.isArray(input.corrections) || input.corrections.length > 5000) throw Error("Filen skal være en rettelsesfil i version 1.");
  const keys = new Set();
  const corrections = input.corrections.map(row => {
    if (!row || typeof row.mailingId !== "string" || !row.mailingId || typeof row.destination !== "string") throw Error("En rettelse mangler udsendelse eller link.");
    let url; try { url = new URL(row.destination); } catch { throw Error("Ugyldigt link i rettelsesfilen."); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw Error("Linket skal være en offentlig adresse uden sporingsparametre.");
    if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 220 || /[<>]/.test(row.title)) throw Error("Overskriften skal være mellem 1 og 220 tegn uden HTML.");
    if (!Object.hasOwn(contentKinds, row.kind) || !editorialTopicNames.includes(row.category)) throw Error("Ukendt indholdstype eller emnekategori.");
    if (row.audienceScope !== undefined && !["all", "targeted", "unknown"].includes(row.audienceScope)) throw Error("Ukendt modtagerafgrænsning.");
    if (row.audiences !== undefined && (!Array.isArray(row.audiences) || row.audiences.length > 20 || row.audiences.some(value => typeof value !== "string" || !value.trim() || value.length > 100 || /[<>]/.test(value)))) throw Error("Ugyldig modtagergruppe.");
    if (row.audienceScope === "targeted" && !row.audiences?.length) throw Error("Målrettet indhold skal have mindst én modtagergruppe.");
    if (row.audienceScope === "all" && row.audiences?.length) throw Error("Indhold til alle kan ikke have særskilte modtagergrupper.");
    const key = correctionKey(row.mailingId, row.destination);
    if (keys.has(key)) throw Error("Filen indeholder flere rettelser til samme link og udsendelse.");
    keys.add(key);
    return { mailingId: row.mailingId, destination: row.destination, title: row.title.trim(), kind: row.kind, category: row.category,
      ...(row.audienceScope ? { audienceScope: row.audienceScope, audiences: (row.audiences || []).map(value => value.trim()) } : {}) };
  });
  return { version: 1, corrections };
}

export function mergeCorrections(shared, local) {
  const map = new Map();
  for (const row of [...shared.corrections, ...local.corrections]) map.set(correctionKey(row.mailingId, row.destination), row);
  return { version: 1, corrections: [...map.values()] };
}

// View model only: original rows, counts and source titles are never mutated.
export function enrichMailings(mailings, correctionFile) {
  const overrides = new Map(correctionFile.corrections.map(row => [correctionKey(row.mailingId, row.destination), row]));
  return mailings.map(mailing => {
    const catalog = new Map((mailing.editorialCatalog || []).map(row => [row.destination, row]));
    const decorate = item => {
      const metadata = catalog.get(item.destination);
      const correction = overrides.get(correctionKey(mailing.id, item.destination));
      const title = correction?.title || metadata?.title || item.title || item.destination;
      const kind = correction?.kind || classifyContent({ ...item, ...metadata });
      return { ...item, editorial: { mailingId: mailing.id, title, kind, category: correction?.category || editorialCategory({ title, destination: item.destination }), source: correction ? "editor" : metadata?.titleSource || "original", ambiguous: !correction && Boolean(metadata?.ambiguous), audienceScope: correction?.audienceScope || metadata?.audienceScope || "unknown", audiences: correction?.audiences || metadata?.audiences || [] } };
    };
    return { ...mailing, content: mailing.content.map(decorate), links: mailing.links.map(decorate), segmentLinkPerformance: (mailing.segmentLinkPerformance || []).map(decorate) };
  });
}
