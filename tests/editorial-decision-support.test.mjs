import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {editorialTakeaway} from '../config/editorial-takeaway.mjs';
const vite=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {EditorialDecisionSupport}=await vite.ssrLoadModule('/app/editorial-decision-support.tsx');
const item=(title,clicks)=>({title,destination:'https://www.dp.dk/'+title,clicks,clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'}});
const row={id:'test',type:'Kompetencenyt',date:'22. okt. 2026',sentAt:'2026-10-22T12:00:00Z',delivered:100,openRate:50,clickRate:10,content:[item('ICD-11',25),item('Supervision',10)],segmentPerformance:[{name:'Ledere',recipients:100,openRate:40,clickRate:5}],segmentLinkPerformance:[]};
const asOf='2026-11-03T12:00:00Z';
const analyze=(selected=row,rows=[selected],audience='')=>editorialTakeaway(rows,{selected,asOf,audience});
test('replaces drafting with an evidenced takeaway for every newsletter',()=>{
 for(const type of ['Kompetencenyt','Psykologernes Nyhedsbrev','Magasinet P','TR/AMR Nyt','Netværksnyt','Medlemskommunikation']) {
  const selected={...row,type};
  const html=renderToStaticMarkup(React.createElement(EditorialDecisionSupport,{rows:[selected],selected,asOf}));
  assert.match(html,/Redaktionelt takeaway/);assert.match(html,/ICD-11/);assert.match(html,/Redaktionel handling/);
  assert.doesNotMatch(html,/<input|<textarea|Gem kladde|Find en relevant tidligere/);
 }
});
test('audiences never inherit whole-mailing link winners',()=>{
 const result=analyze(row,[row],'Ledere');assert.equal(result.links.length,0);assert.doesNotMatch(result.headline,/ICD/);
 const scoped={...row,segmentLinkPerformance:[{...item('Ledelse',8),audience:'Ledere'},{...item('Anden-gruppe',80),audience:'Studerende'}]};
 assert.match(analyze(scoped,[scoped],'Ledere').headline,/Ledelse/);
});
test('immature mailings get provisional actions and no performance verdict',()=>{
 const result=editorialTakeaway([row],{selected:row,asOf:'2026-10-23T12:00:00Z'});
 assert.equal(result.status.status,'preliminary');assert.match(result.action,/vent med/);assert.doesNotMatch(result.performance,/lavere|højere/);
});
test('comparison excludes other newsletters and future issues',()=>{
 const earlier=[1,2,3].map(i=>({...row,id:String(i),sentAt:`2026-09-0${i}T12:00:00Z`,clickRate:5}));
 const result=analyze(row,[row,...earlier,{...row,type:'Other',clickRate:99,sentAt:'2026-10-01T12:00:00Z'},{...row,sentAt:'2026-11-01T12:00:00Z'}]);
 assert.equal(result.comparisonCount,3);assert.equal(result.historyCount,4);assert.match(result.performance,/5 procentpoint over/);
});
test('unknown measurements, zero clicks and unsafe links do not become insights',()=>{
 const selected={...row,content:[{...item('Unknown',999),clickMeasurement:undefined},item('Zero',0),{...item('Unsafe',500),destination:'javascript:alert(1)'}]};
 assert.equal(analyze(selected).links.length,0);
});
test('ties and lower-bound measurements remain explicit',()=>{
 const selected={...row,content:[item('First',25),{...item('Second',25),clickMeasurement:{metric:'unique-contacts',aggregation:'max-per-destination'}}]};
 assert.match(analyze(selected).headline,/deler/);
 const html=renderToStaticMarkup(React.createElement(EditorialDecisionSupport,{rows:[selected],selected,asOf}));assert.match(html,/Mindst 25/);
});
