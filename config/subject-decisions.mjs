import { normalLevel } from './decision-methods.mjs';

const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const normalized = value => clean(value).normalize('NFKC').toLocaleLowerCase('da-DK');
const usableSubject = value => {
  const text = clean(value);
  return text && !/emnefelt mangler|uden titel|{{|}}|<[^>]*>/i.test(text) ? text : null;
};

// A recipient-specific subject must never fall back to a different variant.
export function sentSubject(mailing, audience = '') {
  const variants = mailing.segmentSubjects || [];
  if (audience && (mailing.type === 'Psykologernes Nyhedsbrev' || variants.length)) {
    const subjects = [...new Set(variants.filter(row=>row.audience === audience).map(row=>usableSubject(row.subject)).filter(Boolean))];
    return subjects.length === 1 ? subjects[0] : null;
  }
  if (variants.length) return null;
  return usableSubject(mailing.subject);
}

const publicDestination = value => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.replace(/^www\./,'');
    url.pathname = url.pathname.replace(/\/$/,'') || '/';
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
};

// Exact headline matches provide a source trail, not proof of a lead placement.
// No topic categories, keyword similarity, or click-winner inference is used.
export function storiesNamedInSubject(mailing, subject, audience = '') {
  if (!subject) return [];
  const parts = [...new Set(subject.split(/[|•]/u).map(normalized).filter(part=>part.length >= 15))];
  const measured = audience ? (mailing.segmentLinkPerformance || []).filter(row=>row.audience === audience) : mailing.content || [];
  const candidates = [...measured, ...(mailing.editorialCatalog || []), ...(mailing.content || [])];
  const output = new Map();
  for (const part of parts) {
    const matches = new Map();
    for (const item of candidates) {
      const metadata = item.editorial || item;
      const title = metadata.title || item.title;
      const destination = publicDestination(item.destination);
      if (!destination || metadata.ambiguous || normalized(title) !== part) continue;
      if (audience && metadata.audienceScope === 'targeted' && !metadata.audiences?.includes(audience)) continue;
      matches.set(destination,{title,destination:item.destination});
    }
    if (matches.size !== 1) continue;
    const [key, story] = [...matches.entries()][0];
    const measurements = measured.filter(item=>publicDestination(item.destination) === key);
    const exact = measurements.length === 1 && measurements[0].clickMeasurement?.metric === 'unique-contacts' && measurements[0].clickMeasurement.aggregation === 'single-link' && Number.isFinite(measurements[0].clicks) && measurements[0].clicks >= 0;
    const path = new URL(story.destination).pathname;
    output.set(key,{...story,clicks:exact ? measurements[0].clicks : null,kind:/^\/course\//.test(path) ? 'Kursus' : /^\/p-psykologernes-fagmagasin\/artikler\//.test(path) ? 'P-artikel' : 'Historie'});
  }
  return [...output.values()];
}

/**
 * @param {import('../app/live-data').LiveMailing[]} rows
 * @param {{selected: import('../app/live-data').LiveMailing, audience?: string, asOf: string}} options
 */
export function subjectDecisionEvidence(rows, {selected, audience = '', asOf}) {
  const cutoff = Date.parse(selected.sentAt);
  const scoped = [...new Map(rows.filter(row=>row.type === selected.type && Number.isFinite(Date.parse(row.sentAt)) && Date.parse(row.sentAt) <= cutoff).map(row=>[row.id,row])).values()].sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt));
  const audienceRequired = !audience && (selected.type === 'Psykologernes Nyhedsbrev' || scoped.some(row=>row.segmentSubjects?.length));
  const references = audienceRequired ? [] : scoped.flatMap(mailing=>{
    const subject = sentSubject(mailing,audience);
    if (!subject) return [];
    const click = normalLevel(scoped,mailing,{audience,metric:'clickRate',asOf});
    const open = normalLevel(scoped,mailing,{audience,metric:'openRate',asOf});
    return [{mailing,subject,stories:storiesNamedInSubject(mailing,subject,audience),click,open}];
  });
  return {audienceRequired,references,total:scoped.length,missingSubjects:audienceRequired ? 0 : scoped.length-references.length};
}
