import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { editorialCategory, editorialTopicNames, summarizeEditorialTopics } from "../config/editorial-topics.mjs";

const source = fs.readFileSync(new URL("../app/mock-data.ts", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
const generatorSource = fs.readFileSync(new URL("../scripts/generate-static-dashboard-data.mjs", import.meta.url), "utf8");

test("testdatasættet er tydeligt afgrænset og uden personfelter", () => {
  assert.match(source, /newsletterTypes/);
  assert.doesNotMatch(source, /email|phone|contactId|memberId/i);
});

test("alle centrale udsendelsestyper er repræsenteret", () => {
  for (const type of ["Psykologernes Nyhedsbrev", "TR/AMR Nyt", "Magasinet P", "Kompetencenyt", "Medlemskommunikation"]) assert.match(source, new RegExp(type.replace("/", "\\/")));
});

test("lange målgruppetabeller kan foldes ud", () => {
  assert.match(dashboardSource, /aria-expanded=\{expanded\}/);
  assert.match(dashboardSource, /Vis alle \{total\}/);
  assert.match(dashboardSource, /Vis færre/);
});

test("redaktionelle emner klassificeres med faste og gennemsigtige regler", () => {
  assert.equal(editorialCategory({ title: "Se OK26-resultaterne", destination: "https://dp.dk/ok26" }), "Løn, overenskomst og ansættelse");
  assert.equal(editorialCategory({ title: "Sådan søger du ydernummer", destination: "https://dp.dk/ydernummer" }), "Praksis og ydernummer");
  assert.equal(editorialCategory({ title: "Ny vejledning om autorisation", destination: "https://dp.dk/autorisation" }), "Autorisation, tilsyn og regler");
  assert.equal(editorialCategory({ title: "Børnehus Sjælland", destination: "https://psykologjob.dk/job/" }), "Karriere og job");
  assert.equal(editorialCategory({ title: "Læs opslaget på LinkedIn", destination: "https://linkedin.com/feed/update/123" }), "Andet");
  assert.equal(editorialCategory({ title: "Find din vej ind i psykologfaget", destination: "https://dp.dk/netvaerk-og-job/karriere/" }), "Karriere og job");
  assert.equal(editorialCategory({ title: "Dansk Psykolog Forening i skarp kritik af regionernes udbud", destination: "https://dp.dk/nyheder/udbud" }), "Politik og interessevaretagelse");
  assert.equal(editorialCategory({ title: "Generalforsamling i Selvstændige Psykologers Sektion", destination: "https://dp.dk/gf27" }), "Foreningsliv og demokrati");
  assert.equal(editorialCategory({ title: "Sådan forebygger I moralsk stress", destination: "https://dp.dk/arbejdsmiljoe" }), "Arbejdsmiljø og trivsel");
  assert.equal(editorialCategory({ title: "Ukendt tema", destination: "https://example.com/x" }), "Andet");
  assert.equal(new Set(editorialTopicNames).size, editorialTopicNames.length);
});

test("redaktionelle konklusioner summerer kun dokumenterede linkklik", () => {
  const result = summarizeEditorialTopics([
    { id: "a", content: [{ title: "OK26", destination: "https://dp.dk/ok26", clicks: 40 }, { title: "Ferie", destination: "https://dp.dk/ferie", clicks: 10 }] },
    { id: "b", content: [{ title: "Løn", destination: "https://dp.dk/loen", clicks: 20 }] },
  ]);
  assert.deepEqual(result[0], { category: "Løn, overenskomst og ansættelse", clicks: 70, links: 3, mailings: 2 });
});

test("overblikssiden viser en visuel kategorifordeling med både volumen og klik pr. nyhed", () => {
  assert.match(dashboardSource, /function CategoryInterestChart/);
  assert.match(dashboardSource, /Hvilke emner blev der klikket mest på\?/);
  assert.match(dashboardSource, /klik pr\. nyhed/);
  assert.match(dashboardSource, /topic\.clicks \/ Math\.max\(1, topic\.links\)/);
  assert.match(dashboardSource, /Grafen viser registrerede klik på redaktionelle historier/);
  assert.match(dashboardSource, /aria-label="Periode for indholdsfordeling"/);
  assert.match(dashboardSource, /CategoryInterestChart rows=\{rows\} period=\{period\} onPeriodChange=\{onPeriodChange\}/);
});

test("historiske nyhedsbreve i den valgte 12-månedersperiode får aktuelle linkmålinger", () => {
  assert.match(generatorSource, /dashboardType === "Psykologernes Nyhedsbrev" && issue\.sentAt && new Date\(issue\.sentAt\) >= segmentCutoff/);
  assert.match(generatorSource, /historicalMailing\.linkMeasurementVersion !== 2/);
  assert.match(generatorSource, /replaceHistoricalLinkPerformance/);
});

test("dashboardet forklarer grænsen mellem fælles og målgruppefordelte resultater", () => {
  assert.match(dashboardSource, /Samlede klik i hele udsendelsen uden målgruppefilter/);
  assert.match(dashboardSource, /dokumenterer, hvem der klikkede/);
  assert.match(dashboardSource, /dokumenterer ikke, hvorfor medlemmerne klikkede/);
  assert.match(dashboardSource, /kunne ikke kategoriseres sikkert og står som Andet/);
});

test("Kompetencenyt er en selvstændig, ikke-segmenteret tagvisning", () => {
  assert.match(dashboardSource, /label="Kompetencenyt"/);
  assert.match(dashboardSource, /function CompetenceOverview/);
  assert.match(dashboardSource, /Nyhedsbrevet segmenteres ikke/);
  assert.match(generatorSource, /newsletterTags = \["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P", "TR\/AMR Nyt"\]/);
  assert.match(generatorSource, /issue\.dashboardType === "Psykologernes Nyhedsbrev" && issue\.delivered/);
});

test("Magasinet P er en selvstændig, ikke-segmenteret tagvisning", () => {
  assert.match(dashboardSource, /label="Magasinet P"/);
  assert.match(dashboardSource, /function MagazineOverview/);
  assert.match(dashboardSource, /name: "Kompetencenyt" \| "Magasinet P"/);
  assert.match(generatorSource, /newsletterTags = \["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P", "TR\/AMR Nyt"\]/);
});

test("TR/AMR Nyt er en selvstændig, ikke-segmenteret tagvisning", () => {
  assert.match(dashboardSource, /label="TR\/AMR Nyt"/);
  assert.match(dashboardSource, /function TrAmrOverview/);
  assert.match(dashboardSource, /name="TR\/AMR Nyt"/);
  assert.match(generatorSource, /newsletterTags = \["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P", "TR\/AMR Nyt"\]/);
});

test("Kompetencenyt sammenligner åbning og klik uden en samlet misvisende dom", () => {
  assert.match(dashboardSource, /Sammenligning med tidligere/);
  assert.match(dashboardSource, /<CompetenceComparison openDelta=/);
  assert.match(dashboardSource, /Klikraten er lavere end det tidligere niveau/);
  assert.doesNotMatch(dashboardSource, /Udsendelsen lå under det normale niveau/);
});

test("Kompetencenyt viser Ungappeds mest besøgte links uden redaktionelt servicefilter", () => {
  assert.match(dashboardSource, /item\.clickMeasurement\?\.metric === "unique-contacts"/);
  assert.doesNotMatch(dashboardSource, /latest\.content\.filter\(item => item\.editorial\?\.kind !== "service"\)/);
  assert.match(dashboardSource, /De fem destinationslinks med flest unikke klik i Ungapped/);
});

test("generiske CTA-tekster erstattes af en læsbar destinationstitel", () => {
  assert.match(dashboardSource, /genericCta = \/\^\(tilmeld/);
  assert.match(dashboardSource, /readableDestinationTitle\(item\.destination\)/);
  assert.match(dashboardSource, /replace\(\/\\bboern\\b\/gi, "børn"\)/);
});
