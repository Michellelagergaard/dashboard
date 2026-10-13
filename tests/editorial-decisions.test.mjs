import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialDecisionEvidence, topPeriodNews } from '../config/editorial-decisions.mjs';
const item=(url,clicks=10,topic='Medlemsfordele')=>({destination:'https://www.dp.dk/'+url,title:url,clicks,clickMeasurement:{metric:'unique-contacts'},editorial:{kind:'news',title:url,category:topic}});
const mailing=(id,n,content)=>({id,type:'Psykologernes Nyhedsbrev',sentAt:`2026-09-${String(n).padStart(2,'0')}T12:00:00Z`,content});
const asOf='2026-10-13T12:00:00Z';
test('period news uses the strongest single send, deduplicates tracked URLs and excludes other metrics',()=>{
 const rows=[mailing('old',1,[item('same/?utm_source=mail',90),item('second',75),item('fourth',40)]),mailing('new',2,[item('same/#section',60),item('third',55),{...item('events',999),clickMeasurement:{metric:'total-clicks'}},{...item('unknown',999),clickMeasurement:undefined},{...item('service',999),editorial:{kind:'service'}}])];
 const before=JSON.stringify(rows);const result=topPeriodNews(rows);
 assert.deepEqual(result.map(row=>row.item.clicks),[90,75,55]);assert.equal(result[0].mailing.id,'old');assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(topPeriodNews(rows.slice(1)).map(row=>row.item.clicks),[60,55]);
 assert.deepEqual(topPeriodNews([]),[]);
});
test('period news retains minimum contact measurements and chooses latest send on ties',()=>{
 const old=mailing('old',1,[{...item('same',10),clickMeasurement:{metric:'unique-contacts',aggregation:'max-per-destination'}}]);
 const fresh=mailing('new',2,[old.content[0]]);
 assert.equal(topPeriodNews([old,fresh])[0].mailing.id,'new');assert.equal(topPeriodNews([old,fresh])[0].item.clickMeasurement.aggregation,'max-per-destination');
});
test('repeated signals require three different issues and three destinations',()=>{
 const rows=[1,2,3].map(n=>mailing(String(n),n,[item('fordel-'+n)]));
 const before=JSON.stringify(rows); const result=editorialDecisionEvidence(rows,{asOf});
 assert.equal(result.pattern.count,3);assert.equal(result.pattern.examples.length,3);assert.equal(result.matureCovered,3);assert.equal(JSON.stringify(rows),before);
 assert.equal(editorialDecisionEvidence(rows.slice(0,2),{asOf}).pattern,null);
 assert.equal(editorialDecisionEvidence(rows.map(row=>({...row,content:[item('same')]})),{asOf}).pattern,null);
});
test('duplicates, service links, unknown measurements and young issues cannot establish repetition',()=>{
 const row=mailing('a',1,[item('one'),item('one',20),{...item('service',99),editorial:{kind:'service'}},{...item('old',88),clickMeasurement:undefined}]);
 const fresh={...mailing('young',2,[item('young')]),sentAt:'2026-10-12T12:00:00Z'};
 const result=editorialDecisionEvidence([row,row,fresh],{asOf});
 assert.equal(result.total,2);assert.equal(result.matureCovered,1);assert.equal(result.pattern,null);assert.equal(result.current.item.title,'young');assert.equal(result.preliminary,true);
});
test('selected issues exclude future sends and other newsletters and audience filters never fall back',()=>{
 const selected=mailing('b',2,[item('b')]);
 const rows=[mailing('a',1,[item('a')]),selected,mailing('c',3,[item('c')]),{...mailing('other',1,[item('d')]),type:'Kompetencenyt'}];
 const result=editorialDecisionEvidence(rows,{selected,asOf});assert.equal(result.total,2);assert.equal(result.pattern,null);
 assert.equal(editorialDecisionEvidence(rows,{selected,asOf,audience:'Ledige'}).covered,0);
});
test('magazine signals use P topics and retain lower bounds',()=>{
 const rows=[1,2,3].map(n=>({...mailing(String(n),n,[{...item('p-psykologernes-fagmagasin/artikler/autisme-'+n),editorial:{kind:'unknown',title:'Autisme '+n},clickMeasurement:{metric:'unique-contacts',aggregation:'max-per-destination'}}]),type:'Magasinet P'}));
 const result=editorialDecisionEvidence(rows,{asOf});assert.equal(result.pattern.topic,'Autisme og ADHD');assert.equal(result.pattern.examples[0].item.clickMeasurement.aggregation,'max-per-destination');
});
