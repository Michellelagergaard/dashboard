import test from "node:test";
import assert from "node:assert/strict";
import { classifyIssue, extractLinkCatalog, fetchIssueLinkCatalog, sanitizeIssue, suggestCategory, validateIssues } from "../scripts/ungapped-client.mjs";

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

test("keeps cadence and volume categories as medium-confidence suggestions", () => {
  assert.equal(suggestCategory({ delivered: 13000, sentAt: "2026-08-27T08:00:00Z", apiCategory: ["Nyhedsbrev"] }), "Psykologernes Nyhedsbrev");
  assert.equal(suggestCategory({ delivered: 13000, sentAt: "2026-08-21T08:00:00Z", apiCategory: ["Nyhedsbrev"] }), "Magasinet P");
  assert.equal(suggestCategory({ delivered: 9000, sentAt: "2026-08-18T08:00:00Z", apiCategory: ["Nyhedsbrev"] }), "Kompetencenyt");
  assert.equal(suggestCategory({ delivered: 13000, sentAt: "2026-08-27T08:00:00Z", apiCategory: ["Medlemsoplysninger"] }), null);
  assert.equal(suggestCategory({ delivered: 13000, sentAt: "2026-08-26T08:00:00Z", apiCategory: ["Nyhedsbrev"] }), null);
});

test("detects duplicate ids", () => {
  const valid = { id: "same", delivered: 1, uniqueOpens: 0, uniqueClicks: 0, bounces: 0, unsubscribes: 0 };
  assert.deepEqual(validateIssues([valid, valid]), ["Dubleret udsendelses-id"]);
});

test("classifies the agreed newsletter types and prioritizes flows", () => {
  assert.equal(classifyIssue({ name: "Psykologernes Nyhedsbrev 8. september", tags: [] }), "Psykologernes Nyhedsbrev");
  assert.equal(classifyIssue({ name: "September", tags: ["TR/AMR Nyt"] }), "TR/AMR Nyt");
  assert.equal(classifyIssue({ subject: "Nyt Magasinet P", tags: [] }), "Magasinet P");
  assert.equal(classifyIssue({ name: "Velkomst", tags: ["Kompetencenyt"], automated: true }), "Automatiske flows");
  assert.equal(classifyIssue({ subject: "Nyhedsbrevet fra P: Bliv klogere på traumeområdet", tags: [] }), "Magasinet P");
  assert.equal(classifyIssue({ subject: "Nye kurser – fra supervision til AI", tags: [] }), "Kompetencenyt");
  assert.equal(classifyIssue({ name: "Mail 1: Strakskampagnen", tags: [] }), "Automatiske flows");
  assert.equal(classifyIssue({ subject: "Tomme ramme skabelon BLÅ - BRUG DENNE", tags: [] }), "Test og systemmails");
  assert.equal(classifyIssue({ name: "Ukendt udsendelse", tags: [] }), "Ikke kategoriseret");
  assert.equal(classifyIssue({ name: "September", context: ["Psykologernes Nyhedsbrev"] }), "Psykologernes Nyhedsbrev");
});

test("builds a privacy-reduced link catalog without inventing click counts", () => {
  const result = extractLinkCatalog(`
    <a href="https://www.dp.dk/nyheder/artikel?utm_source=mail#top">Første</a>
    <a href="https://www.dp.dk/nyheder/artikel?contactId=secret">Gentaget</a>
    <a href="https://mail.example.com/unsubscribe?id=secret">Afmeld</a>
    <a href="mailto:person@example.com">Mail</a>
    <a href="https://example.com/member/0123456789abcdef0123456789abcdef">Personligt</a>
  `);
  assert.deepEqual(result.links, [{
    destination: "https://www.dp.dk/nyheder/artikel",
    firstPosition: 1,
    occurrences: 2,
  }]);
  assert.equal(result.excludedCount, 3);
  assert.equal("clicks" in result.links[0], false);
});

test("fetches only issue HTML and returns the reduced catalog", async () => {
  const calls = [];
  const result = await fetchIssueLinkCatalog("secret", "issue-id", async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => ({
      BodyHtml: '<a href="https://www.dp.dk/kurser?utm_campaign=test">Kursus</a>',
      LastModifiedBy: { Email: "must-not-leak@example.com" },
    }) };
  });
  assert.deepEqual(result.links, [{ destination: "https://www.dp.dk/kurser", firstPosition: 1, occurrences: 1 }]);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(calls[0].options.method, "GET");
});
