import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {EditorialDecisionSupport}=await vite.ssrLoadModule('/app/editorial-decision-support.tsx');
const headline='Regionernes udbud efterlader huller i tilbuddet til unge';
const row={id:'pn-example',type:'Psykologernes Nyhedsbrev',date:'22. okt. 2026',sentAt:'2026-10-22T12:00:00Z',subject:'En anden fælles overskrift',delivered:100,openRate:50,clickRate:10,segmentSubjects:[{audience:'Selvstændige',subject:headline}],segmentPerformance:[{name:'Selvstændige',recipients:100,openRate:50,clickRate:10}],content:[{title:headline,destination:'https://www.dp.dk/nyheder/udbud',clicks:25,editorial:{title:headline},clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'}},{title:'Forskertalk om psykoterapi',destination:'https://www.dp.dk/forskertalk',clicks:999}],segmentLinkPerformance:[]};
const render=(audience='')=>renderToStaticMarkup(React.createElement(EditorialDecisionSupport,{rows:[row],selected:row,asOf:'2026-11-03T12:00:00Z',audience,onOpen:()=>{}}));

test('PN requires an audience before exposing subject variants or a draft',()=>{
 const html=render();assert.match(html,/Hvilken målgruppe skriver du til/);assert.doesNotMatch(html,/En anden fælles overskrift|Regionernes udbud|Hovedhistorie til næste udsendelse/);
});
test('shows the actual audience subject and its named story, never an unrelated click winner',()=>{
 const html=render('Selvstændige');assert.match(html,new RegExp(headline));assert.match(html,/Faktisk udsendt emnefelt/);assert.match(html,/https:\/\/www.dp.dk\/nyheder\/udbud/);
 assert.doesNotMatch(html,/Forskertalk|En anden fælles overskrift|Faglighed og praksis ligger/);
 assert.match(html,/Præcist kontaktmål mangler/);assert.match(html,/Se udsendelsen/);
});
test('a missing variant remains missing while next-issue drafting is still available',()=>{
 const html=render('Ledere');assert.match(html,/ingen dokumenterede emnefelter/);assert.doesNotMatch(html,new RegExp(headline));assert.match(html,/Hovedhistorie til næste udsendelse/);assert.match(html,/Udkast til emnefelt/);assert.match(html,/Gem kladde i denne browser/);
});
