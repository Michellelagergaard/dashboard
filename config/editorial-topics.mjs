export const editorialTopicNames = [
  "Politik og interessevaretagelse",
  "Løn, overenskomst og ansættelse",
  "Arbejdsmiljø og trivsel",
  "Autorisation, tilsyn og regler",
  "Faglighed og praksis",
  "Karriere og job",
  "Kurser og arrangementer",
  "Medlemsfordele",
  "Foreningsliv og demokrati",
  "Praksis og ydernummer",
  "Andet",
];

const rules = [
  ["Medlemsfordele", /medlemsfordel|tivoli|rabat|forbrugsforening|politiken|aarstiderne|årstiderne|filmklub|forsikringstilbud/],
  ["Foreningsliv og demokrati", /generalforsamling|\bgf\d{2}\b|repræsentantskab|repraesentantskab|kredsvalg|sektionsvalg|bestyrelsesvalg|arbejdsprogram|frivillig.enhed|kreds|sektion|selskab|netværk|netvaerk/],
  ["Praksis og ydernummer", /ydernummer|selvstændig|selvstaendig|praksisdrift|praksisoverenskomst|honorar|timepris|budgetlægning|budgetlaegning|\bpok\b/],
  ["Løn, overenskomst og ansættelse", /overenskomst|\bok\d{2}\b|\bløn\b|\bloen\b|lønstign|loenstign|lokal.løn|lokal.loen|ansættelse|ansaettelse|ansættelsesvilkår|ansaettelsesvilkaar|arbejdstid|ferie|barsel|pension|frit.valg/],
  ["Arbejdsmiljø og trivsel", /arbejdsmiljø|arbejdsmiljo|\bamr\b|\bapv\b|trivsel|stress|sygefravær|sygefravaer|psykisk.arbejdsmiljø|psykisk.arbejdsmiljo|moralsk.stress/],
  ["Autorisation, tilsyn og regler", /autorisation|autorisationsordning|tilsyn|journalføring|journalforing|journaloplysning|klage|patientklage|lovgivning|persondata|gdpr|tavshedspligt|samtykke|titelbeskyttelse|ppu/],
  ["Karriere og job", /psykologjob|ledige.still|karriere|\bjob\b|jobsøgning|jobsoegning|dimittend|cv\b|ansøgning|ansoegning|vej ind i psykologfaget|lederrolle/],
  ["Kurser og arrangementer", /arrangement|webinar|fyraftensmøde|fyraftensmode|morgenmøde|morgenmoede|kursus|kurser|konference|temamøde|temamoede|tilmeld/],
  ["Politik og interessevaretagelse", /politik|politisk|folketing|regering|minister|høring|horing|udspil|reform|interessevaretagelse|presse|skarp.kritik|udbudssag|regionernes.udbud/],
  ["Faglighed og praksis", /faglig|forsk|psykologfag|behandling|psykiatri|\bppr\b|\bicd|videnscenter|supervision|faglig.norm|retningslinje|evidens/],
];

export function editorialCategory(item) {
  if (editorialTopicNames.includes(item?.editorial?.category)) return item.editorial.category;
  // The actual headline has priority over generic navigation terms in the URL.
  for (const value of [item?.editorial?.title || item?.title || "", decodePath(item?.destination)]) {
    const match = rules.find(([, pattern]) => pattern.test(normalize(value)));
    if (match) return String(match[0]);
  }
  return "Andet";
}

export function summarizeEditorialTopics(mailings) {
  const summary = new Map();
  for (const mailing of mailings) for (const item of mailing.content || []) {
    if (item.editorial && item.editorial.kind !== "news") continue;
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
function decodePath(value) { try { return decodeURIComponent(new URL(value).pathname); } catch { return String(value || ""); } }
