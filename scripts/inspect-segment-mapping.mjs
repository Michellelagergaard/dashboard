import { extractEditorialCatalog } from './editorial-catalog.mjs';
const key=process.env.UG_API;
if(!key) throw Error('Missing key');
async function get(path){ const r=await fetch(new URL(path,'https://api.ungapped.com'),{headers:{'x-api-key':key,accept:'application/json'},signal:AbortSignal.timeout(30000),redirect:'error'}); if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json(); }
function safe(raw){try{const u=new URL(raw);if(!/^https?:$/.test(u.protocol)||/(unsubscribe|afmeld|recipient|contact|email|token|signature|personal)/i.test(u.hostname+u.pathname)||/[{}]/.test(raw))return null;u.search='';u.hash='';u.username='';u.password='';return u.toString();}catch{return null}}
const list=await get('/Issues/SentList?page=0&pageSize=100');
const issues=list.filter(x=>(x.Tags||[]).some(t=>String(t?.Name||t?.TagName||t?.Title||t).trim()==='Psykologernes Nyhedsbrev')).slice(0,3);
for(const [index,issue] of issues.entries()) { const detail=await get(`/Issues/${encodeURIComponent(issue.IssueId)}`); const html=String(detail.BodyHtml||''); const catalog=extractEditorialCatalog(html,safe); console.log('EDITORIAL_CATALOG '+JSON.stringify({index,headings:(html.match(/<h[1-4]\b/gi)||[]).length,catalog:catalog.filter(x=>!/[@]/.test(x.destination))})); }
