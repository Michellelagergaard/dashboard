import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialDecisionEvidence, topPeriodNews } from '../config/editorial-decisions.mjs';
const item=(url,clicks=10,topic='Medlemsfordele')=>({destination:'https://www.dp.dk/'+url,title:url,clicks,clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'},editorial:{kind:'news',title:url,category:topic}});
const mailing=(id,n,content)=>({id,type:'Psykologernes Nyhedsbrev',sentAt:`2026-09-${String(n).padStart(2,'0')}T12:00:00Z`,content});
const asOf='2026-10-13T12:00:00Z';
const issue=(n,topicClicks=10,otherClicks=[80,60,40])=>mailing(String(n),n,[item('topic-'+n,topicClicks),...otherClicks.map((clicks,i)=>item(`other-${n}-${i}`,clicks,'Faglighed og praksis'))]);
const baseline=()=>[1,2,3].map(n=>issue(n));

test('period news still deduplicates tracked URLs, excludes other metrics, and uses strongest single send',()=>{
 const rows=[mailing('old',1,[item('same/?utm_source=mail',90),item('second',75),item('fourth',40)]),mailing('new',2,[item('same/#section',60),item('third',55),{...item('events',999),clickMeasurement:{metric:'total-clicks'}},{...item('unknown',999),clickMeasurement:undefined},{...item('service',999),editorial:{kind:'service'}}])];
 const before=JSON.stringify(rows);const result=topPeriodNews(rows);
 assert.deepEqual(result.map(row=>row.item.clicks),[90,75,55]);assert.equal(result[0].mailing.id,'old');assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(topPeriodNews([]),[]);
});

test('period news retains minimum measurements and chooses latest send on ties',()=>{
 const old=mailing('old',1,[{...item('same',10),clickMeasurement:{metric:'unique-contacts',aggregation:'max-per-destination'}}]);
 const fresh=mailing('new',2,[old.content[0]]);
 assert.equal(topPeriodNews([old,fresh])[0].mailing.id,'new');assert.equal(topPeriodNews([old,fresh])[0].item.clickMeasurement.aggregation,'max-per-destination');
});

test('a new high ranking is compared with the same topic in previous issues without mutating inputs',()=>{
 const rows=[...baseline(),issue(4,100)];const before=JSON.stringify(rows);
 const result=editorialDecisionEvidence(rows,{asOf,selected:rows[3]});
 assert.equal(result.status,'signal');assert.equal(result.signal.topic,'Medlemsfordele');assert.equal(result.signal.delta,100);
 assert.equal(result.signal.stories[0].rank,1);assert.equal(result.signal.history.length,3);assert.equal(result.signal.count,3);
 assert.equal(JSON.stringify(rows),before);
});

test('a recurring core topic stays quiet even if it wins every issue',()=>{
 const result=editorialDecisionEvidence([1,2,3,4,5].map(n=>issue(n,100)),{asOf});
 assert.equal(result.signal,null);assert.equal(result.status,'stable');assert.equal(result.comparisons.find(row=>row.topic==='Medlemsfordele').delta,0);
});

test('a fall also qualifies; scaling raw clicks cannot create a rise',()=>{
 const rows=[1,2,3].map(n=>issue(n,100));rows.push(issue(4,5));
 assert.equal(editorialDecisionEvidence(rows,{asOf}).signal.delta,-100);
 assert.equal(editorialDecisionEvidence([...baseline(),issue(4,100,[800,600,400])],{asOf}).signal,null);
});

test('few contacts, young sends and a short history do not trigger advice',()=>{
 assert.equal(editorialDecisionEvidence([...baseline(),issue(4,12,[8,6,4])],{asOf}).signal,null);
 const young={...issue(4,100),sentAt:'2026-10-12T12:00:00Z'};
 const result=editorialDecisionEvidence([...baseline(),young],{asOf});assert.equal(result.status,'preliminary');assert.equal(result.signal,null);
 assert.equal(editorialDecisionEvidence([issue(1),issue(2),issue(3,100)],{asOf}).status,'history');
 assert.equal(editorialDecisionEvidence([],{asOf}).status,'missing');
});

test('zeroes and ties are retained without an arbitrary destination tie break',()=>{
 const result=editorialDecisionEvidence([...baseline(),issue(4,0,[0,0,0])],{asOf});
 assert.equal(result.storyCount,4);assert.equal(result.signal,null);for(const comparison of result.comparisons) assert.equal(comparison.score,50);
});

test('lower bounds, unknown metrics, service links and duplicate placements do not enter the ranking',()=>{
 const selected=issue(4,100);selected.content[0].clickMeasurement.aggregation='max-per-destination';
 selected.content.push({...item('unknown',999),clickMeasurement:undefined},{...item('service',999),editorial:{kind:'service'}},item('other-4-0/?utm_source=test',999));
 const result=editorialDecisionEvidence([...baseline(),selected],{asOf});
 assert.equal(result.storyCount,2);assert.equal(result.status,'limited');assert.equal(result.signal,null);
});

test('only prior sends of the same type and measurement version count; duplicate issues do not inflate history',()=>{
 const selected=issue(4,100);
 const rows=[issue(1),issue(1),issue(2),{...issue(3),type:'Kompetencenyt'},selected,issue(5)];
 const result=editorialDecisionEvidence(rows,{selected,asOf});assert.equal(result.total,3);assert.equal(result.signal,null);
 const versioned=baseline().map(row=>({...row,linkMeasurementVersion:1}));
 assert.equal(editorialDecisionEvidence([...versioned,{...selected,linkMeasurementVersion:2}],{asOf}).signal,null);
});

test('history requires distinct stories, uses the latest five issues, and excludes normal historical variation',()=>{
 const repeated=baseline().map(row=>({...row,content:row.content.map((link,i)=>i===0?{...link,destination:'https://dp.dk/same'}:link)}));
 assert.equal(editorialDecisionEvidence([...repeated,issue(4,100)],{asOf}).comparisons.some(row=>row.topic==='Medlemsfordele'),false);
 const rows=[1,2,3,4,5,6,7].map(n=>issue(n));rows.push(issue(8,100));
 assert.equal(editorialDecisionEvidence(rows,{asOf}).signal.count,5);
 assert.equal(editorialDecisionEvidence([issue(1),issue(2,100),issue(3),issue(4,100)],{asOf}).signal,null);
});

test('audience filters use only that audience and never fall back to whole-newsletter links',()=>{
 const rows=[...baseline(),issue(4,100)];
 assert.equal(editorialDecisionEvidence(rows,{asOf,audience:'Ledige'}).status,'missing');
 const segmented=rows.map(row=>({...row,segmentLinkPerformance:row.content.map(link=>({...link,audience:'Ledige'}))}));
 assert.equal(editorialDecisionEvidence(segmented,{asOf,audience:'Ledige'}).signal.topic,'Medlemsfordele');
});

test('magazine comparisons use magazine topics and exclude minimum contact counts',()=>{
 const rows=[...baseline(),issue(4,100)].map(row=>({...row,type:'Magasinet P',content:row.content.map((link,i)=>({...link,destination:link.destination.replace('dp.dk/','dp.dk/p-psykologernes-fagmagasin/artikler/'),title:i===0?'Autisme':'Psykoterapi',editorial:{kind:'unknown',title:i===0?'Autisme':'Psykoterapi'}}))}));
 assert.equal(editorialDecisionEvidence(rows,{asOf}).signal.topic,'Autisme og ADHD');
 rows[3].content[0].clickMeasurement={metric:'unique-contacts',aggregation:'max-per-destination'};
 assert.equal(editorialDecisionEvidence(rows,{asOf}).signal,null);
});
