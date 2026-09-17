import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { editorialCategory, editorialTopicNames, summarizeEditorialTopics } from "../config/editorial-topics.mjs";

const source = fs.readFileSync(new URL("../app/mock-data.ts", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

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
  assert.equal(editorialCategory({ title: "Se OK26-resultaterne", destination: "https://dp.dk/ok26" }), "Løn og arbejdsliv");
  assert.equal(editorialCategory({ title: "Sådan søger du ydernummer", destination: "https://dp.dk/ydernummer" }), "Praksis og ydernummer");
  assert.equal(editorialCategory({ title: "Ny vejledning om autorisation", destination: "https://dp.dk/autorisation" }), "Autorisation og regler");
  assert.equal(editorialCategory({ title: "Børnehus Sjælland", destination: "https://psykologjob.dk/job/" }), "Job og karriere");
  assert.equal(editorialCategory({ title: "Læs opslaget på LinkedIn", destination: "https://linkedin.com/feed/update/123" }), "Andet");
  assert.equal(editorialCategory({ title: "Find din vej ind i psykologfaget", destination: "https://dp.dk/netvaerk-og-job/karriere/" }), "Job og karriere");
  assert.equal(editorialCategory({ title: "Ukendt tema", destination: "https://example.com/x" }), "Andet");
  assert.equal(new Set(editorialTopicNames).size, editorialTopicNames.length);
});

test("redaktionelle konklusioner summerer kun dokumenterede linkklik", () => {
  const result = summarizeEditorialTopics([
    { id: "a", content: [{ title: "OK26", destination: "https://dp.dk/ok26", clicks: 40 }, { title: "Ferie", destination: "https://dp.dk/ferie", clicks: 10 }] },
    { id: "b", content: [{ title: "Løn", destination: "https://dp.dk/loen", clicks: 20 }] },
  ]);
  assert.deepEqual(result[0], { category: "Løn og arbejdsliv", clicks: 70, links: 3, mailings: 2 });
});

test("dashboardet forklarer grænsen mellem fælles og målgruppefordelte resultater", () => {
  assert.match(dashboardSource, /Samlede klik i hele udsendelsen uden målgruppefilter/);
  assert.match(dashboardSource, /dokumenterer, hvem der klikkede/);
  assert.match(dashboardSource, /dokumenterer ikke, hvorfor medlemmerne klikkede/);
  assert.match(dashboardSource, /kunne ikke kategoriseres sikkert og står som Andet/);
});
