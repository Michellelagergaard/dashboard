import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialDecisionEvidence } from '../config/editorial-decisions.mjs';
const item=(url,clicks=10,topic='Medlemsfordele')=>({destination:'https://www.dp.dk/'+url,title:url,clicks,clickMeasurement:{metric:'unique-contacts'},editorial:{kind:'news',title:url,category:topic}});
const mailing=(id,n,content)=>({id,type:'Psykologernes Nyhedsbrev',sentAt:`2026-09-${String(n).padStart(2,'0')}T12:00:00Z`,content});
const asOf='2026-10-13T12:00:00Z';
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
