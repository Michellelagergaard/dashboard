import { isComparableLink } from './measurement-methods.mjs';
import { editorialCategory } from './editorial-topics.mjs';
import { isMagazineArticle, magazineTopic, magazineReviewTopic } from './magazine-topics.mjs';

export function editorialDecisionEvidence(rows, { audience = '', selected = null, asOf = '' } = {}) {
  const cutoff = selected ? Date.parse(selected.sentAt) : Infinity;
  const unique = new Map();
  for (const row of rows) if ((!selected || row.type === selected.type) && Number.isFinite(Date.parse(row.sentAt)) && Date.parse(row.sentAt) <= cutoff) unique.set(row.id, row);
  const scoped = [...unique.values()].sort((a,b) => Date.parse(b.sentAt)-Date.parse(a.sentAt));
  const observed = scoped.map(mailing => {
    const destinations = new Map();
    const source = audience ? (mailing.segmentLinkPerformance || []).filter(item => item.audience === audience) : mailing.content || [];
    for (const item of source) {
      const title = item.editorial?.title || item.title || '';
      if (!isComparableLink(item) || !(item.clicks > 0) || !Number.isFinite(item.clicks) || item.editorial?.ambiguous || !title || title === item.destination || /^(tilmeld( dig)?|læs mere|se mere|klik her)$/i.test(title)) continue;
      const magazine = mailing.type === 'Magasinet P' && isMagazineArticle(item);
      if (!magazine && item.editorial?.kind !== 'news') continue;
      const topic = magazine ? magazineTopic({ ...item, title }) : editorialCategory(item);
      if (topic === 'Andet' || topic === magazineReviewTopic) continue;
      const previous = destinations.get(item.destination);
      if (!previous || item.clicks > previous.item.clicks) destinations.set(item.destination,{item,mailing,topic});
    }
    const links = [...destinations.values()].sort((a,b) => b.item.clicks-a.item.clicks || a.item.destination.localeCompare(b.item.destination));
    return {mailing,links,top:links.slice(0,3).map((row,index)=>({...row,rank:index+1})),mature:Date.parse(asOf)-Date.parse(mailing.sentAt)>=7*86400000};
  });
  const mature = observed.filter(row => row.mature && row.links.length);
  const topics = new Map();
  for (const row of mature) for (const example of row.top) {
    const group = topics.get(example.topic) || {topic:example.topic,issueIds:new Set(),destinations:new Set(),examples:[]};
    group.issueIds.add(row.mailing.id);group.destinations.add(example.item.destination);group.examples.push(example);topics.set(example.topic,group);
  }
  const patterns = [...topics.values()].filter(group => group.issueIds.size>=3 && group.destinations.size>=3).map(group=>{
    const examples = [], issueIds = new Set();
    for (const example of group.examples) if (!issueIds.has(example.mailing.id)) {examples.push(example);issueIds.add(example.mailing.id);}
    return {topic:group.topic,count:group.issueIds.size,distinct:group.destinations.size,examples:examples.slice(0,3)};
  }).sort((a,b)=>b.count-a.count || b.distinct-a.distinct || a.topic.localeCompare(b.topic,'da'));
  const current = selected ? observed.find(row=>row.mailing.id===selected.id) : observed[0];
  return {total:scoped.length,covered:observed.filter(row=>row.links.length).length,matureCovered:mature.length,pattern:patterns[0] || null,current:current?.top[0] || null,preliminary:current ? !current.mature : false};
}

export function editorialTestAction(topic) {
  const actions = {
    'Politik og interessevaretagelse':'Vælg én politisk ændring. Skriv rubrikken med dens konkrete konsekvens for målgruppen, og link til den relevante forklaring eller handlemulighed.',
    'Løn, overenskomst og ansættelse':'Vælg én ændring i løn eller vilkår. Gør frist, beløb eller den handling, medlemmet skal tage, tydelig i rubrik og CTA.',
    'Autorisation, tilsyn og regler':'Vælg én regel eller faglig forpligtelse. Forklar, hvad medlemmet skal kontrollere eller gøre, og link direkte til vejledningen.',
    'Praksis og ydernummer':'Vælg én konkret praksisændring. Vis betydningen for drift, honorar eller adgang til ydelser, og slut med én relevant handling.',
    'Medlemsfordele':'Vælg én aktuel fordel. Gør pris, frist og betingelser lette at se, og link direkte til den side, hvor medlemmet kan bruge fordelen.',
    'Kurser og arrangementer':'Vælg ét kursus eller møde. Beskriv den arbejdssituation, det hjælper med, og gør dato, målgruppe og tilmelding tydelig.',
    'Karriere og job':'Vælg én konkret karrieresituation. Giv medlemmet en vej til rådgivning, ansøgning eller et relevant jobtilbud.',
  };
  return actions[topic] || `Vælg én ny historie om ${topic.toLocaleLowerCase('da-DK')}. Gør det konkrete faglige spørgsmål og udbyttet for målgruppen tydeligt i rubrikken.`;
}
