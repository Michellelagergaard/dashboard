import test from "node:test";
import assert from "node:assert/strict";
import worker, { dispatchRefresh } from "./worker.mjs";
import { readFile } from "node:fs/promises";

test("dispatches the existing Pages workflow on main with a secret supplied at runtime", async () => {
  let calls = 0;
  await dispatchRefresh({ GITHUB_ACTIONS_TOKEN: "test-only-token" }, async (url, options) => {
    calls++;
    assert.equal(url, "https://api.github.com/repos/Michellelagergaard/dashboard/actions/workflows/pages.yml/dispatches");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-only-token");
    assert.deepEqual(JSON.parse(options.body), { ref: "main" });
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(null, { status: 204 });
  });
  assert.equal(calls, 1);
});

test("fails before sending when the secret is missing", async () => {
  await assert.rejects(dispatchRefresh({}, () => assert.fail("must not send")), /not configured/);
});

test("reports rejected dispatches without exposing upstream bodies", async () => {
  await assert.rejects(dispatchRefresh({ GITHUB_ACTIONS_TOKEN: "test-only-token" }, async () =>
    new Response("sensitive upstream details", { status: 403 })), { message: "GitHub dispatch failed (HTTP 403)." });
});

test("network errors do not expose credentials or retry a potentially accepted dispatch", async () => {
  let calls = 0;
  await assert.rejects(dispatchRefresh({ GITHUB_ACTIONS_TOKEN: "test-only-token" }, async () => {
    calls++;
    throw new Error("test-only-token");
  }), { message: "GitHub dispatch request failed or timed out; check Actions before retrying." });
  assert.equal(calls, 1);
});

test("the timer is hourly and does not expose an HTTP endpoint", async () => {
  const config = JSON.parse(await readFile(new URL("./wrangler.json", import.meta.url), "utf8"));
  assert.deepEqual(config.triggers.crons, ["13 * * * *"]);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(typeof worker.scheduled, "function");
  assert.equal(worker.fetch, undefined);
});
