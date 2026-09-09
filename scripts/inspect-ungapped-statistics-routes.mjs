const root = "https://app.ungapped.com/App_Vite/dist/vue-root.js?v=2026977";
const response = await fetch(root, { headers: { accept: "application/javascript" } });
if (!response.ok) throw new Error(`Kunne ikke læse statistikklienten: HTTP ${response.status}`);
const source = await response.text();

// Udskriv kun stier, der nævner Issues og Statistics. Ingen svar fra
// statistik-API'et, kontaktdata eller sessionsoplysninger logges.
const matches = new Set();
for (const match of source.matchAll(/[^"'`\\\s]{0,100}(?:Issues|Statistics)[^"'`\\\s]{0,160}/g)) {
  const value = match[0];
  if (/Issues|Statistics/.test(value) && value.length < 260) matches.add(value);
}
console.log(JSON.stringify({ routeCandidates: [...matches].slice(0, 200) }, null, 2));
