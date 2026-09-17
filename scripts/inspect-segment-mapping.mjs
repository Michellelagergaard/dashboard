// Read-only schema and aggregate check; never reads contacts or emits raw HTML.
const key = process.env.UG_API;
if (!key) throw Error('UG_API missing');
async function get(path) {
  const r = await fetch(new URL(path, 'https://api.ungapped.com'), { headers: { 'x-api-key': key, accept: 'application/json' }, signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
}
const list = await get('/Issues/SentList?page=0&pageSize=100');
const issues = list.filter(x => (x.Tags || []).some(t => String(t?.Name || t?.TagName || t?.Title || t).trim() === 'Psykologernes Nyhedsbrev')).slice(0, 3);
const numeric = x => Object.fromEntries(Object.entries(x).filter(([k,v]) => /Count|Rate|Percent/.test(k) && typeof v === 'number').map(([k,v]) => [k, v >= 5 || v === 0 ? v : 'under 5']));
for (const [index, issue] of issues.entries()) {
  const root = `/Issues/${encodeURIComponent(issue.IssueId)}`;
  const overview = await get(root + '/Statistics/Overview');
  const raw = await get(root + '/Statistics/Links');
  const links = Array.isArray(raw) ? raw : raw.Items || raw.Results || raw.Links || [];
  const detail = await get(root);
  const html = String(detail.BodyHtml || '');
  const fieldTags = html.match(/<[^>]*Custom(?:Long|Date|Number)?\d+[^>]*>/gi) || [];
  console.log('TARGETING_MARKUP ' + JSON.stringify({index, tagCount:fieldTags.length, tags:[...new Set(fieldTags.map(t=>(t.match(/^<\/?([\w:-]+)/)||[])[1]))], attributes:[...new Set(fieldTags.flatMap(t=>[...t.matchAll(/\s([\w:-]+)\s*=/g)].map(m=>m[1])))], customTemplateTokenCount:(html.match(/{{[^}]*Custom(?:Long|Date|Number)?\d+[^}]*}}/gi)||[]).length}));
  const conditions = [...html.matchAll(/{{#([^}]*)}}/g)].map(m => m[1]);
  const shape = value => Array.isArray(value) ? {array: value.length, keys: [...new Set(value.filter(v=>v && typeof v==='object').flatMap(Object.keys))]} : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,typeof v])) : typeof value;
  console.log('TARGETING_SCHEMA ' + JSON.stringify({index, detailKeys:Object.keys(detail), segments:shape(detail.Segments), htmlCustomFields:[...new Set(html.match(/(?:Contact\.)?Custom(?:Long|Date|Number)?\d+/gi)||[])], conditionalStructure:conditions.map(c=>c.replace(/(['"])(.*?)\1/g,'$1[value]$1').replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/gi,'[id]').slice(0,200))}));
  console.log('MEASUREMENT_SCHEMA ' + JSON.stringify({index, overviewKeys: Object.keys(overview), overview: numeric(overview), linkKeys: [...new Set(links.flatMap(Object.keys))], linkRows: links.length, contactCountRows: links.filter(r=>typeof r.ContactCount==='number').length, clickCountRows: links.filter(r=>typeof r.ClickCount==='number').length, detailRuleKeys: Object.keys(detail).filter(k=>/filter|segment|dynamic|condition|histor|snapshot/i.test(k)), htmlConditionalBlocks: conditions.length, conditionalFields: [...new Set(conditions.flatMap(c=>c.match(/Contact\.Custom(?:Long|Date|Number)?\d+/g)||[]))], conditionOperators: [...new Set(conditions.flatMap(c=>c.match(/\b(?:contains|equals|compareif|compareelif|compareelse|if|unless)\b/g)||[]))], htmlRuleAttributes: [...new Set((html.match(/\bdata-[a-z-]*(?:condition|filter|segment|target)[a-z-]*/gi)||[]))] }));
}
// Public API landing page may link schema documentation; print only local paths.
try {
  const r = await fetch('https://api.ungapped.com', {signal:AbortSignal.timeout(15000)});
  const html = await r.text();
  console.log('DOCUMENTATION_LINKS ' + JSON.stringify([...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]).filter(p=>/^\//.test(p)&&/swagger|help|openapi|doc/i.test(p)).slice(0,20)));
} catch { console.log('DOCUMENTATION_LINKS unavailable'); }
