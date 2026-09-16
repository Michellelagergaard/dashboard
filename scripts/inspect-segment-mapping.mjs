// Read-only diagnostic. No contacts, cache writes, or dashboard generation.
const key = process.env.UG_API;
if (!key) throw new Error('UG_API mangler');
const wanted = ['1 og 2 års kandidater', 'Ledig DP', 'Pension DP', 'Har ydernummer'];
async function get(path) {
  const response = await fetch(new URL(path, 'https://api.ungapped.com'), {
    headers: { 'x-api-key': key, accept: 'application/json' },
    signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
const list = await get('/Issues/SentList?page=0&pageSize=100');
if (!Array.isArray(list)) throw new Error('Uventet listeformat');
const issues = list.filter(x => (x.Tags || []).some(t => String(t?.Name || t?.TagName || t?.Title || t).trim() === 'Psykologernes Nyhedsbrev')).slice(0, 12);
const output = new Set();
for (const issue of issues) {
  const detail = await get(`/Issues/${encodeURIComponent(issue.IssueId)}`);
  const template = [detail.DynamicSubject, detail.Html, detail.BodyHtml, detail.Body, detail.Content].filter(x => typeof x === 'string').join('\n');
  for (const match of template.matchAll(/{{#([^}]*)}}/g)) {
    const condition = match[1];
    const fields = [...new Set(condition.match(/(?:Contact\.)?Custom(?:Long|Date|Number)?\d+/g) || [])];
    for (const value of wanted) if (condition.toLocaleLowerCase('da').includes(value.toLocaleLowerCase('da'))) {
      output.add(JSON.stringify({ source: 'DynamicSubject condition', membership: value, fields }));
    }
    if (/customlong2/i.test(condition)) {
      // Emit only the field and a primitive comparison, never an arbitrary literal.
      const comparisons = condition.match(/(?:Contact\.)?CustomLong2\s*(?:==|!=|eq|ne|=)\s*(?:true|false|[01]|['"](?:Ja|Nej|true|false|[01])['"])/gi) || [];
      const safeCondition = condition.replace(/(['"])(.*?)\1/g, (_, quote, literal) => quote + (wanted.some(value => literal.toLowerCase().includes(value.toLowerCase())) && literal.length < 80 || /^(true|false|ja|nej|[01]|contains|in|equals|==|!=|=)$/i.test(literal) ? literal : '[redacted]') + quote);
      output.add(JSON.stringify({ source: 'template condition', field: 'CustomLong2', comparisons, safeCondition }));
    }
  }
}
for (const issue of issues.slice(1, 6)) {
  const field = 'CustomLong1';
  for (const value of ['Pension DP', 'Pension']) {
    const query = new URLSearchParams({contactFilter: `((${field} ne null and ${field} ne '' and indexof(${field}, '${value}') ge 0))`});
    const result = await get(`/Issues/${encodeURIComponent(issue.IssueId)}/Statistics/Overview?${query}`);
    console.log('PENSION_CHECK ' + JSON.stringify({value, recipients: result.RecipientCount >= 5 ? result.RecipientCount : 'under 5'}));
  }
}
console.log('MAPPING_METADATA ' + JSON.stringify({ inspectedIssues: issues.length, rules: [...output].map(x => JSON.parse(x)) }));
const latestId = issues[0]?.IssueId;
if (latestId) {
  const baseline = await get(`/Issues/${encodeURIComponent(latestId)}/Statistics/Overview`);
  for (const value of wanted) {
    const field = value === 'Har ydernummer' ? 'CustomLong2' : 'CustomLong1';
    const query = new URLSearchParams({contactFilter: `((${field} ne null and ${field} ne '' and indexof(${field}, '${value}') ge 0))`});
    const result = await get(`/Issues/${encodeURIComponent(latestId)}/Statistics/Overview?${query}`);
    console.log('MAPPING_CHECK ' + JSON.stringify({field, value, filterChangesTotal: result.RecipientCount < baseline.RecipientCount, recipients: result.RecipientCount >= 5 ? result.RecipientCount : 'under 5'}));
  }
}
