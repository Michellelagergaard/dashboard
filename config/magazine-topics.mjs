// Primary topic suggestions are specific to Magasinet P, not PN's service topics.
export const magazineTopicNames = [
  'Autisme og ADHD', 'Børn, unge og familier', 'Traumer, vold og overgreb',
  'Spiseforstyrrelser', 'Psykoterapi og behandlingsmetoder',
  'Krop, sygdom og neuropsykologi', 'Psykiatri, ledelse og organisering',
  'Teknologi og digital behandling', 'Psykologfaget, etik og teori',
];
export const magazineReviewTopic = 'Til emnegennemgang';
// Specific articles whose subject is not clear from the newsletter headline.
// Sources are the canonical article URLs; this is an editorial suggestion.
const exceptions = {
  'hvad-goer-vi-naar-den-klassiske-behandling-ikke-raekker': 'Spiseforstyrrelser',
  'aarets-juniorforsker-2025-har-fundet-et-vindue-af-muligheder-til-forebyggelse-af-sygdom': 'Teknologi og digital behandling',
  'nyudnaevnt-professor-i-kognitiv-og-klinisk-psykologi-det-er-jo-mennesker-vi-behandler-ikke-diagnoser': 'Krop, sygdom og neuropsykologi',
  'naar-det-sociale-bliver-kropsligt': 'Autisme og ADHD',
};
const rules = [
  ['Teknologi og digital behandling', /\bai\b|virtual reality|\bvr\b|vr-briller|sociale medier|digital|skaermen|skaerm/],
  ['Psykiatri, ledelse og organisering', /ledelse|skoleledelse|fagkampe|psyke og somatik|seponering|dobbeltdiagnos/],
  ['Autisme og ADHD', /autism|autist|\badhd\b|\badd\b|\baudhd\b/],
  ['Traumer, vold og overgreb', /traum|\bptsd\b|overgreb|\bvold\b/],
  ['Spiseforstyrrelser', /spiseforstyr|anoreksi|bulimi/],
  ['Børn, unge og familier', /skolefravaer|skolevaegring|kravundgaaende|folkeskol|\bboern\b|\bunge\b|foraeldre|famil/],
  ['Krop, sygdom og neuropsykologi', /kraeft|immunterapi|hjernerystelse|senfolge|senfoelge|overgangsalder|neuropsyk|\bwais\b|\bwisc\b|kropslig/],
  ['Psykologfaget, etik og teori', /eksistentiel|humanistisk|sjael|faglige skoen|videnscenter|fagets identitet|\betik\b|psykologiens/],
  ['Psykoterapi og behandlingsmetoder', /psykoterapi|terapeutisk|gruppeterapi|behandling|remediering|evidens|implementere/],
];
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('da-DK'); }
export function isMagazineArticle(item) {
  try { const url = new URL(item.destination); return /^(www\.)?dp\.dk$/.test(url.hostname) && /^\/p-psykologernes-fagmagasin\/artikler\/[^/]+\/?$/.test(url.pathname); } catch { return false; }
}
export function magazineTopic(item) {
  if (!isMagazineArticle(item)) return null;
  const slug = new URL(item.destination).pathname.split('/').filter(Boolean).at(-1);
  if (exceptions[slug]) return exceptions[slug];
  const title = item.editorial?.title || item.title || '';
  const match = rules.find(([, pattern]) => pattern.test(normalize(title + ' ' + slug.replaceAll('-', ' '))));
  return match ? match[0] : magazineReviewTopic;
}
export function summarizeMagazineTopics(mailings) {
  const measured = [], unmeasured = [];
  for (const mailing of mailings) {
    // One result per URL per mailing; repeated placements must not add counts.
    const byDestination = new Map();
    for (const item of mailing.content || []) {
      if (!isMagazineArticle(item)) continue;
      if (item.clickMeasurement?.metric !== 'unique-contacts' || !Number.isFinite(item.clicks) || item.clicks < 0 || !(mailing.delivered > 0)) { unmeasured.push({ mailingId: mailing.id, destination: item.destination }); continue; }
      const previous = byDestination.get(item.destination);
      if (!previous || item.clicks > previous.clicks) byDestination.set(item.destination, item);
    }
    for (const item of byDestination.values()) measured.push({ ...item, mailingId: mailing.id, date: mailing.date, delivered: mailing.delivered, topic: magazineTopic(item), lowerBound: item.clickMeasurement.aggregation === 'max-per-destination', rate: item.clicks / mailing.delivered * 100 });
  }
  const byTopic = new Map();
  for (const item of measured) {
    if (!byTopic.has(item.topic)) byTopic.set(item.topic, { topic: item.topic, clicks: 0, deliveries: 0, appearances: 0, articleIds: new Set(), mailingIds: new Set(), lowerBound: false, articles: [] });
    const topic = byTopic.get(item.topic); topic.clicks += item.clicks; topic.deliveries += item.delivered; topic.appearances++; topic.articleIds.add(item.destination); topic.mailingIds.add(item.mailingId); topic.lowerBound ||= item.lowerBound; topic.articles.push(item);
  }
  const topics = [...byTopic.values()].map(({ articleIds, mailingIds, ...topic }) => ({ ...topic, uniqueArticles: articleIds.size, mailings: mailingIds.size, averageClicks: topic.clicks / topic.appearances, clickRate: topic.clicks / topic.deliveries * 100 }));
  return { topics, measured, unmeasured: unmeasured.length, coveredMailings: new Set(measured.map(item => item.mailingId)).size, uniqueArticles: new Set(measured.map(item => item.destination)).size };
}
