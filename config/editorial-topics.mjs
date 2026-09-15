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
  ["Praksis og ydernummer", /ydernummer|selvstændig|selvstaendig|praksis|honorar|budgetlægning|budgetlaegning|regionernes.udbud|\bpok\b/],
  ["Løn og arbejdsliv", /overenskomst|\bok\d{2}\b|\bløn\b|\bloen\b|lønstign|loenstign|rettighed|ferie|arbejdsliv|arbejdsmiljø|arbejdsmiljo|barsel|pension/],
  ["Autorisation og regler", /autorisation|tilsyn|journalføring|journalforing|klage|lovgivning|lovforslag|persondata|gdpr/],
  ["Job og karriere", /psykologjob|ledige.still|karriere|\bjob\b|dimittend/],
  ["Faglighed og forskning", /faglig|forsk|psykologfag|behandling|psykiatri|\bppr\b|\bicd|videnscenter|supervision/],
  ["Medlemsfordele og arrangementer", /medlemsfordel|tivoli|rabat|arrangement|webinar|fyraftensmøde|fyraftensmode|tilmeld|kursus|forbrugsforening/],
  ["Politik og presse", /politik|folketing|\bvalg\b|høring|horing|presse|reaktion|generalforsamling|\bgf\d{2}\b/],
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
