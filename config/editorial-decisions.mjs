import { isComparableLink } from './measurement-methods.mjs';
import { editorialCategory } from './editorial-topics.mjs';
import { isMagazineArticle, magazineTopic, magazineReviewTopic } from './magazine-topics.mjs';

// A repeated story occupies one place, using its strongest single-issue result.
export function topPeriodNews(rows, limit = 3) {
  const stories = new Map();
  for (const mailing of rows) for (const item of mailing.content || []) {
    if (!isComparableLink(item) || item.editorial?.kind !== 'news' || !Number.isFinite(item.clicks) || item.clicks <= 0) continue;
    let key;
    try {
      const url = new URL(item.destination);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      for (const name of [...url.searchParams.keys()]) if (/^utm_/i.test(name) || /^(fbclid|gclid)$/i.test(name)) url.searchParams.delete(name);
      url.hostname = url.hostname.replace(/^www\./, '');
      url.pathname = url.pathname.replace(/\/$/, '') || '/';
      url.searchParams.sort();
      key = url.href;
    } catch { continue; }
    const previous = stories.get(key);
    if (!previous || item.clicks > previous.item.clicks || (item.clicks === previous.item.clicks && Date.parse(mailing.sentAt) > Date.parse(previous.mailing.sentAt))) stories.set(key, { item, mailing });
  }
  return [...stories.values()].sort((a, b) => b.item.clicks - a.item.clicks || a.item.destination.localeCompare(b.item.destination)).slice(0, limit);
}

// Editorial screening rules, not a statistical significance test.
export const editorialComparisonPolicy = Object.freeze({ minStories: 4, minHistory: 3, maxHistory: 5, minShift: 25, minContacts: 25 });

function canonicalDestination(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}

const median = values => {
  const sorted = [...values].sort((a,b)=>a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
};

/**
 * @param {import('../app/live-data').LiveMailing[]} rows
 * @param {{audience?: string, selected?: import('../app/live-data').LiveMailing | null, asOf?: string}} [options]
 */
export function editorialDecisionEvidence(rows, { audience = '', selected = null, asOf = '' } = {}) {
  const cutoff = selected ? Date.parse(selected.sentAt) : Infinity;
  const unique = new Map();
  const scope = selected || [...rows].sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt))[0];
  for (const row of rows) if (row.type === scope?.type && Number.isFinite(Date.parse(row.sentAt)) && Date.parse(row.sentAt) <= cutoff) unique.set(row.id, row);
  const scoped = [...unique.values()].sort((a,b) => Date.parse(b.sentAt)-Date.parse(a.sentAt));
  const observed = scoped.map(mailing => {
    const destinations = new Map();
    const source = audience ? (mailing.segmentLinkPerformance || []).filter(item => item.audience === audience) : mailing.content || [];
    for (const item of source) {
      const title = item.editorial?.title || item.title || '';
      if (!isComparableLink(item) || item.clicks < 0 || !Number.isFinite(item.clicks) || item.editorial?.ambiguous || !title || title === item.destination || /^(tilmeld( dig)?|læs mere|se mere|klik her)$/i.test(title)) continue;
      const magazine = mailing.type === 'Magasinet P' && isMagazineArticle(item);
      if (!magazine && item.editorial?.kind !== 'news') continue;
      const topic = magazine ? magazineTopic({ ...item, title }) : editorialCategory(item);
      if (topic === 'Andet' || topic === magazineReviewTopic) continue;
      const key = canonicalDestination(item.destination);
      if (!key) continue;
      const previous = destinations.get(key);
      // Two placements are a lower bound, even when each placement is exact.
      if (previous) {
        previous.exact = false;
        if (item.clicks > previous.item.clicks) previous.item = item;
      } else destinations.set(key,{item,mailing,topic,key,exact:item.clickMeasurement.aggregation === 'single-link'});
    }
    const links = [...destinations.values()].sort((a,b) => b.item.clicks-a.item.clicks || a.item.destination.localeCompare(b.item.destination));
    const exact = links.filter(row=>row.exact);
    const ranked = exact.map(example=>{
      const below = exact.filter(row=>row.item.clicks < example.item.clicks).length;
      const tied = exact.filter(row=>row.item.clicks === example.item.clicks).length;
      return {...example,rank:1+exact.filter(row=>row.item.clicks > example.item.clicks).length,fieldSize:exact.length,score:exact.length > 1 ? 100*(below+(tied-1)/2)/(exact.length-1) : 50};
    });
    return {mailing,links,ranked,mature:Date.parse(asOf)-Date.parse(mailing.sentAt)>=7*86400000};
  });
  const mature = observed.filter(row => row.mature && row.links.length);
  const current = selected ? observed.find(row=>row.mailing.id===selected.id) : observed[0];
  const usable = row => row.ranked.length >= editorialComparisonPolicy.minStories && new Set(row.ranked.map(link=>link.topic)).size >= 2;
  const comparisons = [];
  if (current?.mature && usable(current)) for (const topic of new Set(current.ranked.map(row=>row.topic))) {
    const stories = current.ranked.filter(row=>row.topic===topic);
    const history = mature.filter(row=>Date.parse(row.mailing.sentAt)<Date.parse(current.mailing.sentAt) && usable(row) && row.mailing.linkMeasurementVersion === current.mailing.linkMeasurementVersion && row.ranked.some(link=>link.topic===topic)).slice(0,editorialComparisonPolicy.maxHistory);
    const previousStories = history.flatMap(row=>row.ranked.filter(link=>link.topic===topic));
    if (history.length < editorialComparisonPolicy.minHistory || new Set(previousStories.map(row=>row.key)).size < 3) continue;
    const historicalScores = history.map(row=>median(row.ranked.filter(link=>link.topic===topic).map(link=>link.score)));
    const score = median(stories.map(row=>row.score));
    const baseline = median(historicalScores);
    const delta = score-baseline;
    // A recurring core subject only qualifies if its relative rank changes.
    const outsideRange = score < Math.min(...historicalScores) || score > Math.max(...historicalScores);
    const enoughContacts = current.ranked.some(row=>row.item.clicks>=editorialComparisonPolicy.minContacts);
    comparisons.push({topic,score,baseline,delta,count:history.length,stories,history:history.map(row=>({mailing:row.mailing,stories:row.ranked.filter(link=>link.topic===topic)})),notable:outsideRange && enoughContacts && Math.abs(delta)>=editorialComparisonPolicy.minShift});
  }
  const signals = comparisons.filter(row=>row.notable).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta) || a.topic.localeCompare(b.topic,'da'));
  const status = !current?.links.length ? 'missing' : !current.mature ? 'preliminary' : !usable(current) ? 'limited' : !current.ranked.some(row=>row.item.clicks>=editorialComparisonPolicy.minContacts) ? 'sparse' : !comparisons.length ? 'history' : signals.length ? 'signal' : 'stable';
  return {total:scoped.length,covered:observed.filter(row=>row.links.length).length,matureCovered:mature.length,current:current?.mailing || null,storyCount:current?.ranked.length || 0,status,comparisons,signal:signals[0] || null};
}
