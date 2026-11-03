import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({root,configFile:false,server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const { EditorialDecisionSupport } = await vite.ssrLoadModule('/app/editorial-decision-support.tsx');
const asOf='2026-11-03T12:00:00Z';
const make=(n,clicks=100)=>({id:'example-'+n,type:'TR/AMR Nyt',date:`${n}. okt. 2026`,sentAt:`2026-10-0${n}T12:00:00Z`,content:[clicks,80,60,40].map((clicks,i)=>({title:`Historie ${n}-${i}`,destination:`https://www.dp.dk/historie-${n}-${i}`,clicks,editorial:{kind:'news',category:i===0?'Medlemsfordele':'Faglighed og praksis'},clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'}}))});
const render=rows=>renderToStaticMarkup(React.createElement(EditorialDecisionSupport,{rows,selected:rows.at(-1),asOf}));

test('stable core content and young sends have explanations instead of invented recommendations',()=>{
 const stable=render([1,2,3,4].map(n=>make(n)));
 assert.match(stable,/Ingen tydelig afvigelse at handle på/);
 assert.doesNotMatch(stable,/Til redaktionsmødet|Vælg én ændring|Læs historien og vurder/);
 const young=render([make(1),{...make(4,12),sentAt:'2026-11-02T12:00:00Z'}]);
 assert.match(young,/Udsendelsen er stadig for ny/);assert.doesNotMatch(young,/Til redaktionsmødet/);
});

test('a supported change shows current and historical stories with working article and issue controls',()=>{
 const html=renderToStaticMarkup(React.createElement(EditorialDecisionSupport,{rows:[make(1,10),make(2,10),make(3,10),make(4)],selected:make(4),asOf,onOpen:()=>{}}));
 assert.match(html,/Medlemsfordele ligger højere/);
 assert.match(html,/href="https:\/\/www.dp.dk\/historie-4-0"/);
 assert.match(html,/href="https:\/\/www.dp.dk\/historie-3-0"/);
 assert.match(html,/nr\. 1 af 4/);assert.match(html,/nr\. 4 af 4/);
 assert.match(html,/Se udsendelsen/);assert.match(html,/Til redaktionsmødet/);
});

test('missing, limited, sparse and short-history states all render without a suggestion',()=>{
 const cases=[
  [[],/Linkdata mangler/],
  [[make(1).content[0]],/For få sammenlignelige historier/],
  [make(1).content.map(link=>({...link,clicks:0})),/Klikgrundlaget er endnu for lille/],
  [make(1).content,/Historikken er endnu for tynd/],
 ];
 for(const [content,expected] of cases){const html=render([{...make(1),content}]);assert.match(html,expected);assert.doesNotMatch(html,/Til redaktionsmødet/);}
});
