import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkpointStatus, comparisonPoint, median, mergeCheckpointLedgers, normalLevel, recordCheckpoints, validateCheckpointLedger } from "../config/decision-methods.mjs";
import { mergeNotes, validateNotes } from "../config/editorial-notes.mjs";
const asOf="2026-12-01T12:00:00Z";
const issue=(id,date,clickRate=10,delivered=1000)=>({id,sentAt:date,clickRate,openRate:50,delivered,measurementVersion:2,segmentPerformance:[]});
const current=issue("current","2026-11-20T12:00:00Z",15);
const prior=[1,2,3,4,5,6].map((n)=>issue(String(n),`2026-11-${String(20-n).padStart(2,"0")}T12:00:00Z`,n===1?80:10+n));
test("median is robust to an outlier and preserves genuine zero",()=>{assert.equal(median([10,11,12,13,80]),12);assert.equal(median([0,0,20]),0);assert.equal(median([]),null);});
test("normal level uses the five most recent earlier comparable issues, not the selected issue",()=>{
  const result=normalLevel([current,...prior].reverse(),current,{asOf});
  assert.deepEqual(result.used.map(p=>p.mailing.id),["1","2","3","4","5"]);
  assert.equal(result.baseline,14);assert.equal(result.delta,1);assert.equal(result.low,12);assert.equal(result.high,80);
});
test("small samples, fresh issues and missing current values never become a zero baseline",()=>{
  assert.equal(normalLevel(prior.slice(0,2),current,{asOf}).baseline,null);
  const young=normalLevel(prior,{...current,sentAt:"2026-11-30T12:00:00Z"},{asOf});
  assert.equal(young.baseline,14);assert.equal(young.delta,null);
  assert.equal(normalLevel(prior,{...current,clickRate:undefined},{asOf}).delta,null);
  assert.equal(comparisonPoint(current,"Ledige").value,null);
});
test("large audience-size changes and future sends are excluded",()=>{
  const result=normalLevel([...prior,issue("small","2026-11-19T15:00:00Z",99,400),issue("large","2026-11-19T16:00:00Z",90,1600),issue("future","2026-12-02",80)],current,{asOf});
  assert.equal(result.excluded,2);assert.equal(result.used.some(p=>["small","large","future"].includes(p.mailing.id)),false);
});
test("audiences are compared only to their own prior values",()=>{
  const decorate=row=>({...row,segmentPerformance:[{name:"Ledige",recipients:200,clickRate:4,openRate:40},{name:"Pensionister",recipients:800,clickRate:80,openRate:90}]});
  const result=normalLevel(prior.map(decorate),decorate(current),{audience:"Ledige",asOf});assert.equal(result.baseline,4);
});
test("fixed measurements cannot be mixed with history, other checkpoints or other methods",()=>{
  const decorate=(row,day=7,version=2)=>({...row,checkpoints:[{...row,day,measurementVersion:version,capturedAt:"2026-11-27T12:00:00Z"}]});
  const rows=prior.map(row=>decorate(row));
  assert.equal(normalLevel(rows,decorate(current),{mode:"7",asOf}).baseline,14);
  assert.equal(normalLevel(rows,decorate(current),{mode:"1",asOf}).baseline,null);
  assert.equal(normalLevel(prior.map(row=>decorate(row,7,1)),decorate(current),{mode:"7",asOf}).baseline,null);
  assert.equal(comparisonPoint(current,"","7").value,null);
});
const empty={version:1,records:[]};
const live={...issue("new","2026-10-01T10:00:00Z"),fetchedAt:"2026-10-02T10:17:00Z",unsubscribes:0};
test("a future issue gets an immutable one-day checkpoint without changing original data",()=>{
  const before=JSON.stringify(live);const first=recordCheckpoints(empty,live);assert.equal(first.records.length,1);assert.equal(first.records[0].day,1);
  assert.deepEqual(recordCheckpoints(first,{...live,clickRate:99,fetchedAt:"2026-10-02T11:00:00Z"}),first);
  assert.equal(JSON.stringify(live),before);assert.deepEqual(empty,{version:1,records:[]});
});
test("early, late, old and invalid measurements are not backdated",()=>{
  for(const row of [{...live,fetchedAt:"2026-10-02T09:59:00Z"},{...live,fetchedAt:"2026-10-02T16:00:01Z"},{...live,sentAt:"2026-09-10T10:00:00Z",fetchedAt:"2026-09-11T10:00:00Z"},{...live,delivered:0},{...live,measurementVersion:1}])assert.equal(recordCheckpoints(empty,row).records.length,0);
});
test("a seven-day checkpoint is separate and can follow a missed one-day checkpoint",()=>{
  const ledger=recordCheckpoints(empty,{...live,fetchedAt:"2026-10-08T10:30:00Z"});assert.equal(ledger.records[0].day,7);
  assert.equal(checkpointStatus(live,1,"2026-10-08T12:00:00Z").status,"missed");
  assert.equal(checkpointStatus(live,7,"2026-10-07T10:00:00Z").status,"waiting");
  assert.equal(checkpointStatus({...live,checkpoints:ledger.records},7,asOf).status,"captured");
});
test("stale or late segment lookups are never passed off as fixed measurements",()=>{
  const segment={name:"Ledige",recipients:100,delivered:99,openRate:50,clickRate:8,measurementVersion:2};
  assert.equal(recordCheckpoints(empty,live,[segment],"2026-10-02T11:00:00Z").records[0].segmentPerformance.length,1);
  assert.equal(recordCheckpoints(empty,live,[segment],"2026-10-02T17:00:00Z").records[0].segmentPerformance.length,0);
  assert.equal(recordCheckpoints(empty,live,[{...segment,measurementVersion:undefined}],"2026-10-02T11:00:00Z").records[0].segmentPerformance.length,0);
});
test("merging persistent ledgers keeps the saved measurement and every other issue",()=>{
  const saved=recordCheckpoints(empty,live),incoming=recordCheckpoints(empty,{...live,clickRate:99});
  incoming.records.push({...incoming.records[0],mailingId:"another"});
  const merged=mergeCheckpointLedgers(saved,incoming);assert.equal(merged.records.length,2);assert.equal(merged.records[0].clickRate,10);
  assert.throws(()=>validateCheckpointLedger({version:1,records:[...saved.records,...saved.records]}));
  assert.throws(()=>validateCheckpointLedger({version:1,records:[{}]}));
});
test("the newest editorial note wins without losing other issues or audiences",()=>{
  const note={mailingId:"a",audience:"",observation:"Vurdering",decision:"Afprøv",status:"open",followUp:"2026-10-15",updatedAt:"2026-10-01T10:00:00Z"};
  const saved={version:1,notes:[note,{...note,audience:"Ledige"}]};
  const result=mergeNotes(saved,{version:1,notes:[{...note,decision:"Ældre",updatedAt:"2026-09-30T10:00:00Z"},{...note,mailingId:"b"}]});
  assert.equal(result.notes.length,3);assert.equal(result.notes[0].decision,"Afprøv");
  assert.throws(()=>validateNotes({version:1,notes:[{...note,audience:"Ukendt"}]}));
  assert.throws(()=>validateNotes({version:1,notes:[note,note]}));
  validateNotes(JSON.parse(readFileSync(new URL("../config/editorial-notes.json",import.meta.url))));
});
