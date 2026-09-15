export const editorialTopicNames = [
  "Praksis og ydernummer",
  "Løn og arbejdsliv",
  "Autorisation og regler",
  "Faglighed og forskning",
  "Medlemsfordele og arrangementer",
  "Job og karriere",
  "Politik og presse",
  "Andet",
];

const rules = [
  ["Praksis og ydernummer", /ydernummer|selvst.ndig|praksis|honorar|budgetl.gning|regionernes.udbud|pok\b/],
  ["Løn og arbejdsliv", /overenskomst|ok\d{2}|l.n|rettighed|ferie|arbejdsliv|arbejdsmilj|barsel|pension/],
  ["Autorisation og regler", /autorisation|tilsyn|journalf.r|klage|lovgivning|lovforslag|persondata|gdpr/],
  ["Faglighed og forskning", /faglig|forsk|psykologfag|behandling|psykiatri|ppr|icd|videnscenter|supervision/],
  ["Medlemsfordele og arrangementer", /medlemsfordel|tivoli|rabat|arrangement|webinar|fyraftensm.de|tilmeld|kursus|forbrugsforening/],
  ["Job og karriere", /psykologjob|ledige.still|karriere|job\b|dimittend/],
  ["Politik og presse", /linkedin|politik|folketing|valg\b|h.ring|presse|reaktion/],
];

export function editorialCategory(item) {
  const haystack = normalize(`${item?.title || ""} ${item?.destination || ""}`);
  return rules.find(([, pattern]) => pattern.test(haystack))?.[0] || "Andet";
}

export function summarizeEditorialTopics(mailings) {
  const summary = new Map();
  for (const mailing of mailings) for (const item of mailing.content || []) {
    const category = editorialCategory(item);
    const current = summary.get(category) || { category, clicks: 0, links: 0, mailingIds: new Set() };
    current.clicks += Number(item.clicks) || 0;
    current.links += 1;
    current.mailingIds.add(mailing.id);
    summary.set(category, current);
  }
  return [...summary.values()]
    .map((item) => ({ category: item.category, clicks: item.clicks, links: item.links, mailings: item.mailingIds.size }))
    .sort((a, b) => b.clicks - a.clicks || a.category.localeCompare(b.category, "da"));
}

function normalize(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("da-DK"); }
