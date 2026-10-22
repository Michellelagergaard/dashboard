import test from "node:test";
import assert from "node:assert/strict";
import { combineMailings, canonicalMailingId, combinedMailingGroups } from "../config/combined-mailings.mjs";

const ids = combinedMailingGroups[0].ids;
const measurement = { metric: "unique-contacts", aggregation: "single-link", source: "ContactCount", sourceRows: 1 };
function part(index, delivered, opens, clicks) {
  const segment = { name: "Ledige", recipients: delivered, delivered, recipientsLabel: String(delivered), openCount: opens, clickCount: clicks, openRate: opens/delivered*100, clickRate: clicks/delivered*100, unsubscribes: 0, measurementVersion: 2, observedAt: "2026-10-22T14:00:00Z" };
  return { id: ids[index], title: "Skabelon", subject: "Skabelon", type: "Psykologernes Nyhedsbrev", date: "22. okt. 2026", sentAt: `2026-10-22T12:${index ? "23" : "10"}:00Z`, delivered, openCount: opens, clickCount: clicks, openRate: opens/delivered*100, clickRate: clicks/delivered*100, unsubscribes: index,
    content: [{ title: "Historie", destination: "https://dp.dk/nyhed", clicks, recipients: delivered, rate: clicks/delivered*100, clickMeasurement: measurement, editorial: {title:"Rettet titel", mailingId:ids[index],kind:"news"} }],
    links: [{destination:"https://dp.dk/nyhed",firstPosition:1,occurrences:1}],
    segments: ["Ledige"], segmentPerformance: [segment], segmentSubjects: [{audience:"Ledige",subject:"Segmenteret emnefelt"}],
    segmentLinkPerformance: [{destination:"https://dp.dk/nyhed",audience:"Ledige",clicks,rate:clicks/delivered*100,clickMeasurement:measurement}],
    checkpoints: [], dataCoverage: {linkPerformance:true,segmentPerformance:true,segmentSubjects:true,segmentLinkPerformance:true} };
}

test("two explicit parts become one weighted issue without mutating source or combining other issues", () => {
  const a=part(0,100,40,10), b=part(1,900,90,18), other={...part(0,100,20,2),id:"unrelated"};
  const source=[a,b,other], before=JSON.stringify(source);
  const merged=combineMailings(source);
  const result=merged.find(row=>row.id===ids[0]);
  assert.equal(merged.length,2);
  assert.equal(result.delivered,1000);
  assert.equal(result.openCount,130);
  assert.equal(result.clickCount,28);
  assert.equal(result.openRate,13);
  assert.ok(Math.abs(result.clickRate-2.8)<1e-10);
  assert.equal(result.unsubscribes,1);
  assert.equal(result.subject,combinedMailingGroups[0].subject);
  assert.equal(result.deliveryParts.length,2);
  assert.equal(result.sentAt,b.sentAt);
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(combineMailings(merged),merged);
  assert.equal(merged.find(row=>row.id==='unrelated'),other);
});

test("audience rates, subjects and story clicks combine with the right denominators", () => {
  const merged=combineMailings([part(0,100,40,10),part(1,900,90,18)])[0];
  assert.equal(merged.segmentPerformance[0].recipients,1000);
  assert.equal(merged.segmentPerformance[0].openRate,13);
  assert.equal(merged.segmentSubjects.length,1);
  assert.equal(merged.segmentSubjects[0].subject,"Segmenteret emnefelt");
  assert.equal(merged.content.length,1);
  assert.equal(merged.content[0].clicks,28);
  assert.equal(merged.content[0].recipients,1000);
  assert.equal(merged.content[0].editorial.title,"Rettet titel");
  assert.equal(merged.segmentLinkPerformance[0].clicks,28);
  assert.ok(Math.abs(merged.segmentLinkPerformance[0].rate-2.8)<1e-10);
});

test("missing or suppressed segments are not treated as zero and partial links are lower bounds", () => {
  const a=part(0,100,40,10),b=part(1,900,90,18);
  b.segmentPerformance=[];b.content=[];b.dataCoverage.linkPerformance=false;
  const merged=combineMailings([a,b])[0];
  assert.deepEqual(merged.segmentPerformance,[]);
  assert.deepEqual(merged.segmentLinkPerformance,[]);
  assert.equal(merged.content[0].clicks,10);
  assert.equal(merged.content[0].clickMeasurement.aggregation,"max-per-destination");
  assert.equal(merged.dataCoverage.linkPerformance,false);
});

test("fixed observations require both parts and use weighted rates without inventing counts", () => {
  const a=part(0,100,40,10),b=part(1,900,90,18);
  const point=(p,day)=>({...p,mailingId:p.id,day,capturedAt:"2026-10-23T13:00:00Z",segmentsObservedAt:"2026-10-23T13:00:00Z",openCount:undefined,clickCount:undefined});
  a.checkpoints=[point(a,1),point(a,7)];b.checkpoints=[point(b,1)];
  const merged=combineMailings([a,b])[0];
  assert.equal(merged.checkpoints.length,1);
  assert.equal(merged.checkpoints[0].day,1);
  assert.equal(merged.checkpoints[0].delivered,1000);
  assert.equal(merged.checkpoints[0].openRate,13);
  assert.equal(merged.checkpoints[0].openCount,undefined);
});

test("a single available part stays unchanged and both old links resolve to the combined issue", () => {
  const source=[part(0,100,40,10)];
  assert.equal(combineMailings(source),source);
  assert.equal(canonicalMailingId(ids[1]),ids[0]);
  assert.equal(canonicalMailingId("unrelated"),"unrelated");
});
