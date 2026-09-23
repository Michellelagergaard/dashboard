import { load } from "cheerio";
import { memberSegments } from "../config/member-segments.mjs";

export const editorialCatalogVersion = 2;
const generic = /^(læs(?: mere| her| artiklen)?|se(?: mere| her)?|klik her|tilmeld(?: dig)?|gå til.*|åbn|her|read more)[.!… »›→]*$/i;
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const usable = value => value.length >= 8 && value.length <= 220 && !generic.test(value) && !/https?:|\{\{|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value);

// Only issue HTML is read. No destination pages, contact data or HTML are stored.
// A heading must belong to a small, unambiguous block containing the same link.
export function extractEditorialCatalog(html, safeDestination) {
  const $ = load(String(html || ""));
  $("script,style,head").remove();
  const records = new Map();
  $("a[href]").each((_, anchor) => {
    const destination = safeDestination($(anchor).attr("href"));
    if (!destination) return;
    const exposure = targetAudienceFor($(anchor), $);
    const candidates = [];
    const add = (value, source, score) => { value = clean(value); if (usable(value)) candidates.push({ title: value, titleSource: source, score }); };
    // A linked heading is direct evidence, even inside a large layout table.
    $(anchor).find("h1,h2,h3,h4").each((_, el) => add($(el).text(), "heading", 100));
    const enclosingHeading = $(anchor).closest("h1,h2,h3,h4");
    if (enclosingHeading.length) add(enclosingHeading.text(), "heading", 100);
    let block = $(anchor).parent();
    for (let depth = 0; block.length && depth < 12; depth++, block = block.parent()) {
      if (["body", "html"].includes(block[0].tagName)) break;
      const headings = block.find("h1,h2,h3,h4").filter((_, el) => usable(clean($(el).text())));
      const destinations = new Set(block.find("a[href]").toArray().map(el => safeDestination($(el).attr("href"))).filter(Boolean));
      // Never borrow a neighbouring story's heading or the newsletter heading.
      if (headings.length > 1 || destinations.size > 1) break;
      if (headings.length === 1) { add(headings.first().text(), "heading", 90); break; }
      const styled = block.find("p,strong,b,span").filter((_, el) => {
        const size = /font-size\s*:\s*(\d+(?:\.\d+)?)px/i.exec($(el).attr("style") || "");
        return size && Number(size[1]) >= 20 && usable(clean($(el).text()));
      });
      const titles = [...new Set(styled.toArray().map(el => clean($(el).text())))];
      if (titles.length === 1) { add(titles[0], "styled-heading", 80); break; }
      if (titles.length > 1) break;
    }
    add($(anchor).text(), "link-text", 60);
    $(anchor).find("img[alt]").each((_, el) => add($(el).attr("alt"), "image-alt", 30));
    const candidate = candidates.sort((a,b) => b.score - a.score)[0];
    if (!candidate) return;
    const existing = records.get(destination);
    if (!existing) records.set(destination, { destination, ...candidate, exposures: [exposure] });
    else {
      existing.exposures.push(exposure);
      if (candidate.score > existing.score) Object.assign(existing, candidate);
      else if (candidate.score === existing.score && candidate.title !== existing.title) existing.ambiguous = true;
    }
  });
  return [...records.values()].map(record => {
    const item = { ...record, ...mergeExposures(record.exposures) };
    delete item.score;
    delete item.exposures;
    return item;
  });
}

function targetAudienceFor(anchor, $) {
  const conditions = anchor.parents().addBack().filter((_, el) => Object.keys(el.attribs || {}).some(name => name.startsWith("ug-targetaudience-")));
  if (!conditions.length) return { audienceScope: "all", audiences: [] };
  const audiences = new Set();
  let hasUnmappedCondition = false;
  conditions.each((_, el) => {
    const attrs = el.attribs || {};
    const serialized = Object.entries(attrs).filter(([name]) => name.startsWith("ug-targetaudience-")).map(([, value]) => String(value)).join(" ").toLowerCase();
    const matches = memberSegments.filter(segment => serialized.includes(segment.value.toLowerCase()));
    if (matches.length) matches.forEach(segment => audiences.add(segment.label));
    else hasUnmappedCondition = true;
  });
  return hasUnmappedCondition || !audiences.size
    ? { audienceScope: "unknown", audiences: [...audiences] }
    : { audienceScope: "targeted", audiences: [...audiences] };
}

function mergeExposures(exposures) {
  if (exposures.some(item => item.audienceScope === "all")) return { audienceScope: "all", audiences: [] };
  const audiences = [...new Set(exposures.flatMap(item => item.audiences || []))];
  if (exposures.some(item => item.audienceScope === "unknown") || !audiences.length) return { audienceScope: "unknown", audiences };
  return { audienceScope: "targeted", audiences };
}
