import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reduceLinkStatistics, sanitizeIssue, fetchIssueSegmentPerformance } from "../scripts/ungapped-client.mjs";
import { summarizeSegmentRates, clickMeasurementLabel, isComparableLink } from "../config/measurement-methods.mjs";
import { mergeHistoricalMailing, publicSegmentRows } from "../scripts/dashboard-history.mjs";

const url = "https://www.dp.dk/news";
test("contact counts and click events retain distinct definitions, including zero", () => {
  assert.deepEqual(reduceLinkStatistics([{Url:url,ContactCount:0,ClickCount:100}]), []);
  const [unique] = reduceLinkStatistics([{Url:url,ContactCount:6,ClickCount:100}]);
  assert.equal(unique.clicks,6);
  assert.equal(unique.clickMeasurement.metric,"unique-contacts");
  assert.equal(unique.clickMeasurement.source,"ContactCount");
  const [total] = reduceLinkStatistics([{Url:url,ClickCount:100}]);
  assert.equal(total.clickMeasurement.metric,"total-clicks");
  assert.equal(isComparableLink(total),false);
  assert.equal(clickMeasurementLabel(total),"Samlede klik");
  assert.equal(clickMeasurementLabel({clicks:100}),"Historisk klikmål");
  assert.equal(isComparableLink({clicks:100}),false);
});

test("repeated placements give a lower bound, never a sum or event/contact maximum", () => {
  const [row] = reduceLinkStatistics([{Url:url+'?utm_source=one',ContactCount:8,ClickCount:20},{Url:url,ContactCount:10},{Url:url,ClickCount:90}]);
  assert.equal(row.clicks,10);
  assert.equal(row.clickMeasurement.metric,"unique-contacts");
  assert.equal(row.clickMeasurement.aggregation,"max-per-destination");
  assert.equal(row.clickMeasurement.sourceRows,3);
  assert.equal(clickMeasurementLabel(row),"Mindst dette antal kontakter");
});

test("human-readable course slugs survive privacy filtering while opaque ids do not", () => {
  const course = "https://www.dp.dk/course/familieterapi-teori-og-intervention-403313/?utm_source=Ungapped";
  const [row] = reduceLinkStatistics([{ Url: course, ContactCount: 174, ClickCount: 191 }]);
  assert.equal(row.destination, "https://www.dp.dk/course/familieterapi-teori-og-intervention-403313/");
  assert.equal(row.clicks, 174);

  const opaque = "https://example.com/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  assert.deepEqual(reduceLinkStatistics([{ Url: opaque, ContactCount: 9 }]), []);
});

test("zero deliveries are not replaced with recipients", async () => {
  const stats = {RecipientCount:100,ReceivedCount:0,ClickCount:0,OpenCount:0};
  const issue = sanitizeIssue({IssueId:'x'},stats);
  assert.equal(issue.delivered,0);
  assert.equal(issue.clickRate,null);
  const result = await fetchIssueSegmentPerformance('test','x',async () => ({ok:true,status:200,json:async()=>stats}));
  assert.deepEqual(result.results,[]);
});

test("segment averages weight by deliveries instead of recipient labels", () => {
  const result=summarizeSegmentRates([{recipientsLabel:'1.000',delivered:100,openRate:50,clickRate:10},{recipientsLabel:'1.000',delivered:900,openRate:20,clickRate:2}]);
  assert.equal(result.click,2.8);
  assert.equal(result.open,23);
  assert.equal(result.method,'delivered');
});

test("incomplete historical deliveries use an explicitly unweighted mean", () => {
  const result=summarizeSegmentRates([{recipientsLabel:'1.000',delivered:100,openRate:50,clickRate:10},{recipientsLabel:'100',openRate:20,clickRate:2}]);
  assert.equal(result.click,6);
  assert.equal(result.method,'per-issue');
  assert.equal(summarizeSegmentRates([]).click,null);
});

test("new segment rows retain the actual recipient and delivery denominators", () => {
  const [row]=publicSegmentRows([{name:'Ledige',recipients:100,delivered:90,openRate:50,clickRate:10,ctor:20,unsubscribes:0,measurementVersion:2,membershipTimeBasis:'not-verified'}]);
  assert.equal(row.recipients,100);
  assert.equal(row.delivered,90);
  assert.equal(row.measurementVersion,2);
});

test("all recorded baseline rows survive a measurement rollout without numeric changes", () => {
  const baseline=JSON.parse(readFileSync(new URL('../data/dashboard-history-baseline.json',import.meta.url),'utf8'));
  for(const old of baseline.mailings) {
    const merged=mergeHistoricalMailing({...old},old);
    for(const field of ['content','links','segmentPerformance','segmentSubjects','segmentLinkPerformance']) assert.deepEqual(merged[field].map(JSON.stringify).sort(),old[field].map(JSON.stringify).sort());
    for(const row of merged.content) assert.equal(row.clickMeasurement,undefined);
  }
});

test("the complete pre-change archive keeps all 42 issues and their saved rows", () => {
  const archive=JSON.parse(readFileSync(new URL('../data/pre-measurement-v2.json',import.meta.url),'utf8'));
  assert.equal(archive.mailings.length,42);
  for(const old of archive.mailings) {
    const merged=mergeHistoricalMailing({ ...old, measurementVersion:2, content:[], links:[], segmentPerformance:[], segmentSubjects:[], segmentLinkPerformance:[] },old);
    for(const field of ['content','links','segmentPerformance','segmentSubjects','segmentLinkPerformance']) assert.deepEqual(merged[field].map(JSON.stringify).sort(),old[field].map(JSON.stringify).sort());
  }
});
