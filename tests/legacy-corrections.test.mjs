import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveLegacyCorrections } from "../config/legacy-corrections.mjs";
import { enrichMailings, mergeCorrections, validateCorrections } from "../config/editorial-content.mjs";

const row = { mailingId: "one", destination: "https://dp.dk/a", title: "Fælles titel", kind: "news", category: "Andet" };
const shared = { version: 1, corrections: [row, { ...row, mailingId: "two" }] };

test("fresh browsers and empty legacy files keep shared corrections without a recovery notice", () => {
  for (const stored of [null, "", '{"version":1,"corrections":[]}']) {
    const result = resolveLegacyCorrections(shared, stored);
    assert.deepEqual(result.file, shared);
    assert.equal(result.localCount, 0);
    assert.equal(result.error, "");
  }
});

test("legacy precedence and audience fields survive without rewriting source or backup bytes", () => {
  const local = { version: 1, corrections: [{ ...row, title: "Lokal titel", audienceScope: "targeted", audiences: ["Ledige"] }] };
  const raw = JSON.stringify(local, null, 4) + "\n";
  const before = JSON.stringify(shared);
  const result = resolveLegacyCorrections(shared, raw);
  assert.deepEqual(result.file, mergeCorrections(shared, validateCorrections(local)));
  assert.equal(result.raw, raw);
  assert.equal(result.localCount, 1);
  assert.equal(JSON.stringify(shared), before);
  const item = { destination: row.destination, title: "Læs mere", clicks: 42, rate: 7 };
  const mailings = [{ id: "one", content: [item], links: [item], segmentLinkPerformance: [{ ...item, audience: "Ledige" }] }];
  const original = JSON.stringify(mailings);
  const enriched = enrichMailings(mailings, result.file)[0];
  for (const field of ["content", "links", "segmentLinkPerformance"]) {
    assert.equal(enriched[field][0].editorial.title, "Lokal titel");
    assert.deepEqual(enriched[field][0].editorial.audiences, ["Ledige"]);
    assert.equal(enriched[field][0].clicks, 42);
    assert.equal(enriched[field][0].rate, 7);
  }
  assert.equal(JSON.stringify(mailings), original);
});

test("invalid legacy files remain recoverable verbatim and never partially override shared corrections", () => {
  for (const raw of ['{broken', 'null', JSON.stringify({version:1,corrections:[row, {...row,mailingId:"two",kind:"invalid"}]})]) {
    const result = resolveLegacyCorrections(shared, raw);
    assert.deepEqual(result.file, shared);
    assert.equal(result.raw, raw);
    assert.match(result.error, /ikke slettet/);
  }
  const result = resolveLegacyCorrections(shared, "unavailable");
  assert.deepEqual(result.file, shared);
  assert.equal(result.raw, null);
  assert.match(result.error, /blokeret/);
});

test("actual approved corrections and archive render identically to the former shared-only path", () => {
  const approved = validateCorrections(JSON.parse(readFileSync(new URL("../config/editorial-overrides.json", import.meta.url))));
  const archive = JSON.parse(readFileSync(new URL("../data/pre-editorial-v1.json", import.meta.url))).mailings;
  const before = JSON.stringify(archive);
  const result = resolveLegacyCorrections(approved, "");
  assert.deepEqual(enrichMailings(archive, result.file), enrichMailings(archive, mergeCorrections(approved, {version:1,corrections:[]})));
  assert.equal(JSON.stringify(archive), before);
});
