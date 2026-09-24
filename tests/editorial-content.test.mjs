import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractEditorialCatalog } from "../scripts/editorial-catalog.mjs";
import { classifyContent, enrichMailings, mergeCorrections, validateCorrections } from "../config/editorial-content.mjs";
import { editorialCategory, summarizeEditorialTopics } from "../config/editorial-topics.mjs";
import { fetchIssueEditorialCatalog } from "../scripts/ungapped-client.mjs";
const safe = raw => { try { const url = new URL(raw); if (!/^https?:$/.test(url.protocol)) return null; url.search = ""; return url.toString(); } catch { return null; } };

test("shared editorial corrections are valid before publication", () => {
  const file=JSON.parse(readFileSync(new URL("../config/editorial-overrides.json",import.meta.url)));
  assert.deepEqual(validateCorrections(file),file);
});

test("headlines stay with their own story across nested newsletter tables", () => {
  const result = extractEditorialCatalog(`<table><tr><td><h1>Psykologernes Nyhedsbrev</h1></td></tr>
    <tr><td><h2>Din løn stiger til oktober</h2><p>Brødtekst</p><table><tr><td><a href="https://dp.dk/a">Læs mere</a></td></tr></table></td></tr>
    <tr><td><h2>Nye regler for autorisation</h2><a href="https://dp.dk/b">Se mere</a></td></tr>
    <tr><td><a href="https://dp.dk/c">Læs mere</a></td></tr></table>`, safe);
  assert.equal(result.find(x => x.destination.endsWith("/a")).title, "Din løn stiger til oktober");
  assert.equal(result.find(x => x.destination.endsWith("/b")).title, "Nye regler for autorisation");
  assert.equal(result.some(x => x.destination.endsWith("/c")), false);
});

test("styled headings and HTML entities are read, conflicting titles remain ambiguous", () => {
  const result = extractEditorialCatalog(`<div><p style="font-size:24px"><strong>Løn &amp; arbejdsliv</strong></p><a href="https://dp.dk/a">Læs mere</a></div>
    <div><h2>Første stillingsannonce</h2><a href="https://psykologjob.dk/job/?id=1">Læs</a></div>
    <div><h2>Anden stillingsannonce</h2><a href="https://psykologjob.dk/job/?id=2">Læs</a></div>`, safe);
  assert.equal(result[0].title, "Løn & arbejdsliv");
  assert.equal(result[0].titleSource, "styled-heading");
  assert.equal(result[1].ambiguous, true);
});

test("heading extraction reads only sent HTML and excludes private links", async () => {
  const data = await fetchIssueEditorialCatalog("test", "x", async () => ({ok:true,json:async()=>({BodyHtml:'<div><h2>Privat overskrift</h2><a href="https://example.com/unsubscribe?token=secret">Læs mere</a></div><div><h2>Faglig nyhed</h2><a href="https://dp.dk/nyhed?contactId=secret">Læs mere</a></div>'})}));
  assert.equal(data.length,1);
  assert.equal(data[0].destination,"https://dp.dk/nyhed");
  assert.equal(JSON.stringify(data).includes("secret"),false);
  await assert.rejects(fetchIssueEditorialCatalog("test","x",async()=>({ok:true,json:async()=>({AutosavedHtml:"draft"})})));
});

test("sent targeting rules distinguish common and targeted stories", () => {
  const html = `<div><h2>Fælles historie</h2><a href="https://dp.dk/faelles">Læs mere</a></div>
    <div ug-targetaudience-property="Custom3" ug-targetaudience-operator="contains" ug-targetaudience-value="Hospitalssektionen"><h2>Regional historie</h2><a href="https://dp.dk/regional">Læs mere</a></div>
    <div ug-targetaudience-property="Custom99" ug-targetaudience-value="Ukendt regel"><h2>Ukendt historie</h2><a href="https://dp.dk/ukendt">Læs mere</a></div>`;
  const rows = extractEditorialCatalog(html, value => value);
  assert.deepEqual(rows.find(row => row.destination.endsWith("/faelles")).audienceScope, "all");
  assert.deepEqual(rows.find(row => row.destination.endsWith("/regional")).audiences, ["Regionalt ansatte"]);
  assert.deepEqual(rows.find(row => row.destination.endsWith("/ukendt")).audienceScope, "unknown");
});

test("utility links are separate, social posts are not confused with profiles", () => {
  assert.equal(classifyContent({destination:"https://mitdp.dk/Home/MyProfile/",titleSource:"heading"}),"service");
  assert.equal(classifyContent({destination:"https://dp.dk/uddannelse-og-karriere/kurser-og-arrangementer/"}),"service");
  assert.equal(classifyContent({destination:"https://linkedin.com/feed/update/123/",titleSource:"heading"}),"news");
  assert.equal(classifyContent({destination:"https://linkedin.com/company/dp/",titleSource:"heading"}),"service");
  assert.equal(classifyContent({destination:"https://psykologjob.dk/job/",titleSource:"heading"}),"unknown");
});

test("headline topic has priority over navigation path and corrections have priority over both", () => {
  assert.equal(editorialCategory({title:"Nye regler for autorisation",destination:"https://dp.dk/netvaerk-og-job/karriere/test"}),"Autorisation, tilsyn og regler");
  assert.equal(editorialCategory({title:"Nye regler for autorisation",destination:"https://dp.dk/x",editorial:{category:"Politik og interessevaretagelse"}}),"Politik og interessevaretagelse");
  assert.equal(editorialCategory({title:"Ukendt",destination:"https://dp.dk/nyheder/l%C3%B8nstigning"}),"Løn, overenskomst og ansættelse");
});

test("corrections are scoped to issue and URL and update both result views without modifying source", () => {
  const row={title:"Læs mere",destination:"https://dp.dk/a",clicks:10,rate:1};
  const source=[{id:"one",content:[row],links:[row],segmentLinkPerformance:[{...row,audience:"Ledige"}]},{id:"two",content:[row],links:[],segmentLinkPerformance:[]}];
  const before=JSON.stringify(source);
  const corrections=validateCorrections({version:1,corrections:[{mailingId:"one",destination:row.destination,title:"En rettet overskrift",kind:"news",category:"Politik og interessevaretagelse"}]});
  const result=enrichMailings(source,corrections);
  assert.equal(result[0].content[0].editorial.title,"En rettet overskrift");
  assert.equal(result[0].segmentLinkPerformance[0].editorial.category,"Politik og interessevaretagelse");
  assert.equal(result[1].content[0].editorial.title,"Læs mere");
  assert.equal(JSON.stringify(source),before);
  assert.equal(result[0].content[0].rate,1);
});

test("import validates the entire file before use and merging retains unrelated corrections", () => {
  const row={mailingId:"a",destination:"https://dp.dk/a",title:"En rettelse",kind:"news",category:"Andet"};
  const shared={version:1,corrections:[row,{...row,mailingId:"b"}]};
  const local={version:1,corrections:[{...row,title:"Ny rettelse"}]};
  assert.equal(mergeCorrections(shared,local).corrections.length,2);
  assert.equal(mergeCorrections(shared,local).corrections[0].title,"Ny rettelse");
  for(const invalid of [{...row,destination:"javascript:alert(1)"},{...row,category:"Opfundet"},{...row,title:"<script>"}]) assert.throws(()=>validateCorrections({version:1,corrections:[row,invalid]}));
  assert.throws(()=>validateCorrections({version:1,corrections:[row,row]}));
});

test("service traffic and uncertain items cannot become a news-topic conclusion", () => {
  const summary=summarizeEditorialTopics([{id:"a",content:[
    {clicks:500,editorial:{kind:"service",category:"Karriere og job"}},
    {clicks:300,editorial:{kind:"unknown",category:"Politik og interessevaretagelse"}},
    {clicks:10,editorial:{kind:"news",category:"Løn, overenskomst og ansættelse"}},
  ]}]);
  assert.deepEqual(summary,[{category:"Løn, overenskomst og ansættelse",clicks:10,links:1,mailings:1}]);
});

test("the complete archive survives editorial enrichment with all original fields intact", () => {
  const source=JSON.parse(readFileSync(new URL("../data/pre-editorial-v1.json",import.meta.url))).mailings;
  const result=enrichMailings(source,{version:1,corrections:[]});
  for(let i=0;i<source.length;i++){
    const restored={...result[i]};
    for(const field of ["content","links","segmentLinkPerformance"]) restored[field]=restored[field].map(item=>{const row={...item};delete row.editorial;return row;});
    assert.deepEqual(restored,source[i]);
  }
});
