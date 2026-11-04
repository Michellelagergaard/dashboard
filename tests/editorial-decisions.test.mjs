import test from 'node:test';
import assert from 'node:assert/strict';
import { topPeriodNews } from '../config/editorial-decisions.mjs';
const item=(url,clicks=10,topic='Medlemsfordele')=>({destination:'https://www.dp.dk/'+url,title:url,clicks,clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'},editorial:{kind:'news',title:url,category:topic}});
const mailing=(id,n,content)=>({id,type:'Psykologernes Nyhedsbrev',sentAt:`2026-09-${String(n).padStart(2,'0')}T12:00:00Z`,content});

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
