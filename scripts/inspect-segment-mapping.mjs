// Read-only diagnostic. No contacts, cache writes, or dashboard generation.
const key = process.env.UG_API;
if (!key) throw new Error('UG_API mangler');
const wanted = ['1 og 2 års kandidater', 'Ledig DP', 'Pension DP'];
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
  for (const match of String(detail.DynamicSubject || '').matchAll(/{{#([^}]*)}}/g)) {
    const condition = match[1];
    const fields = [...new Set(condition.match(/(?:Contact\.)?Custom(?:Long|Date|Number)?\d+/g) || [])];
    for (const value of wanted) if (condition.toLocaleLowerCase('da').includes(value.toLocaleLowerCase('da'))) {
      output.add(JSON.stringify({ source: 'DynamicSubject condition', membership: value, fields }));
    }
    if (/customlong2/i.test(condition)) {
      // Emit only the field and a primitive comparison, never an arbitrary literal.
      const comparisons = condition.match(/(?:Contact\.)?CustomLong2\s*(?:==|!=|eq|ne|=)\s*(?:true|false|[01]|['"](?:Ja|Nej|true|false|[01])['"])/gi) || [];
      output.add(JSON.stringify({ source: 'DynamicSubject condition', field: 'CustomLong2', comparisons }));
    }
  }
}
console.log('MAPPING_METADATA ' + JSON.stringify({ inspectedIssues: issues.length, rules: [...output].map(x => JSON.parse(x)) }));
