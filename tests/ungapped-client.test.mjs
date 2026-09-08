import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeIssue, validateIssues } from "../scripts/ungapped-client.mjs";

test("sanitizes an Ungapped issue and calculates weighted rates", () => {
  const issue = sanitizeIssue(
    { IssueId: "abc", IssueName: "Test", Subject: "Emne", Ended: "2026-09-07T10:00:00Z", CreatedBy: "must not leak" },
    { RecipientCount: 1000, ReceivedCount: 970, FailedCount: 10, BounceCount: 20, OpenCount: 485, ClickCount: 97, UnsubscribeCount: 2 },
  );
  assert.equal(issue.delivered, 970);
  assert.equal(issue.openRate, 50);
  assert.equal(issue.clickRate, 10);
  assert.equal("CreatedBy" in issue, false);
});

test("detects duplicate ids", () => {
  const valid = { id: "same", delivered: 1, uniqueOpens: 0, uniqueClicks: 0, bounces: 0, unsubscribes: 0 };
  assert.deepEqual(validateIssues([valid, valid]), ["Dubleret udsendelses-id"]);
});
