import test from "node:test";
import assert from "node:assert/strict";
import { fetchDashboardSnapshot, selectNewerDashboardData } from "../config/dashboard-refresh.mjs";

const mailing = { id: "issue-1", title: "Test", subject: "Test", type: "Kompetencenyt", date: "20. nov. 2026", sentAt: "2026-11-20T08:00:00Z", delivered: 1000, openRate: 40, clickRate: 8, unsubscribes: 1, content: [], links: [], segments: [] };
const current = { status: "live", updatedAt: "2026-11-20T09:00:00Z", mailings: [mailing] };
const next = { schemaVersion: 1, status: "live", updatedAt: "2026-11-20T10:00:00Z", mailings: [{ ...mailing, clickRate: 10 }] };

test("a newer published snapshot updates metrics and the actual data timestamp", () => {
  const result = selectNewerDashboardData(current, next);
  assert.equal(result.mailings[0].clickRate, 10);
  assert.equal(result.updatedAt, next.updatedAt);
  assert.equal(current.mailings[0].clickRate, 8);
});

test("equal and older snapshots cannot roll back displayed data", () => {
  for (const updatedAt of [current.updatedAt, "2026-11-20T08:00:00Z"]) {
    assert.equal(selectNewerDashboardData(current, { ...next, updatedAt }), current);
  }
});

test("invalid, empty and incompatible snapshots preserve the last good data", () => {
  for (const payload of [null, {}, { ...next, schemaVersion: 2 }, { ...next, status: "unavailable" }, { ...next, updatedAt: "invalid" }, { ...next, mailings: [] }, { ...next, mailings: [{}] }, { ...next, mailings: [{ ...mailing, content: null }] }]) {
    assert.equal(selectNewerDashboardData(current, payload), current);
  }
});

test("a valid publication replaces the safe empty development fallback", () => {
  const empty = { status: "unavailable", updatedAt: null, mailings: [] };
  assert.equal(selectNewerDashboardData(empty, next).mailings.length, 1);
});

test("requests bypass browser caches and stay under the dashboard base path", async () => {
  const controller = new AbortController();
  const result = await fetchDashboardSnapshot(new URL("https://example.com/dashboard/dashboard-data.json"), {
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      assert.equal(parsed.pathname, "/dashboard/dashboard-data.json");
      assert.ok(parsed.searchParams.has("refresh"));
      assert.equal(options.cache, "no-store");
      assert.equal(options.signal, controller.signal);
      return { ok: true, json: async () => next };
    },
  });
  assert.equal(result, next);
});

test("HTTP, network and malformed JSON failures do not become data", async () => {
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => { throw new Error("offline"); },
    async () => ({ ok: true, json: async () => { throw new Error("invalid JSON"); } }),
  ]) await assert.rejects(fetchDashboardSnapshot("https://example.com/dashboard/dashboard-data.json", { fetchImpl }));
});
