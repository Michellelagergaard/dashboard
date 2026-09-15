import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/mock-data.ts", import.meta.url), "utf8");
const dashboardSource = fs.readFileSync(new URL("../app/dashboard.tsx", import.meta.url), "utf8");

test("testdatasættet er tydeligt afgrænset og uden personfelter", () => {
  assert.match(source, /newsletterTypes/);
  assert.doesNotMatch(source, /email|phone|contactId|memberId/i);
});

test("alle centrale udsendelsestyper er repræsenteret", () => {
  for (const type of ["Psykologernes Nyhedsbrev", "TR/AMR Nyt", "Magasinet P", "Kompetencenyt", "Medlemskommunikation"]) assert.match(source, new RegExp(type.replace("/", "\\/")));
});

test("målgruppevisningen sammenligner med eget normalniveau", () => {
  assert.match(dashboardSource, /Målgruppens normale niveau/);
  assert.match(dashboardSource, /series\.slice\(1, 6\)/);
  assert.match(dashboardSource, /ReferenceLine/);
});

test("lange målgruppetabeller kan foldes ud", () => {
  assert.match(dashboardSource, /aria-expanded=\{expanded\}/);
  assert.match(dashboardSource, /Vis alle \{total\}/);
  assert.match(dashboardSource, /Vis færre/);
});
