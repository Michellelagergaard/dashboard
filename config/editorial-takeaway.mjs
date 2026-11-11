import { normalLevel, comparisonStatus } from './decision-methods.mjs';
import { isComparableLink } from './measurement-methods.mjs';

const number = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 });
const rate = value => `${number(value)} %`;

export function editorialTakeaway(rows, { selected, asOf, audience = '' }) {
  const history = rows.filter(row => row.type === selected.type && Date.parse(row.sentAt) <= Date.parse(selected.sentAt));
  const click = normalLevel(history, selected, { audience, asOf });
  const open = normalLevel(history, selected, { audience, asOf, metric: 'openRate' });
  const status = comparisonStatus(click);
  const source = audience ? (selected.segmentLinkPerformance || []).filter(row => row.audience === audience) : selected.content || [];
  const destinations = new Map();
  for (const item of source) {
    if (!isComparableLink(item) || !Number.isFinite(item.clicks) || item.clicks <= 0 || item.editorial?.ambiguous) continue;
    try { if (!['http:', 'https:'].includes(new URL(item.destination).protocol)) continue; } catch { continue; }
    const previous = destinations.get(item.destination);
    if (!previous || item.clicks > previous.clicks) destinations.set(item.destination, item);
  }
  const links = [...destinations.values()].sort((a, b) => b.clicks - a.clicks);
  const leader = links[0], runner = links[1];
  const title = item => item.editorial?.title || item.title || 'Link uden dokumenteret titel';
  const tied = leader && runner && leader.clicks === runner.clicks;
  let headline = 'Der mangler grundlag for en redaktionel konklusion';
  let interpretation = audience ? 'Der er ikke dokumenterede linkresultater for denne målgruppe. Det samlede nyhedsbrevs klik kan ikke bruges som udtryk for gruppens interesser.' : 'Der er ikke dokumenterede kontaktklik på de enkelte links. Udsendelsens rater alene viser ikke, hvilke historier læserne reagerede på.';
  let action = 'Brug udsendelsens redaktionelle formål til at prioritere næste udgave, og afvent dokumenterede linkresultater før indholdet omprioriteres.';
  if (leader) {
    headline = tied ? 'Flere indgange deler den største målte interesse' : `Størst målt interesse: ${title(leader)}`;
    interpretation = tied
      ? `“${title(leader)}” og “${title(runner)}” deler førstepladsen blandt de dokumenterede links. Tallene giver derfor ikke grundlag for at vælge én entydig indholdsvinder.`
      : `“${title(leader)}” har flest dokumenterede kontaktklik i udsendelsen${audience ? ' for ' + audience : ''}. Det peger på en konkret indgang, som læserne har reageret på${runner ? `; “${title(runner)}” er den næstmest klikkede` : ''}.`;
    action = tied
      ? 'Afprøv de to indgange hver for sig i kommende udsendelser, så det bliver tydeligere, hvilken der skaber respons.'
      : `Undersøg, om “${title(leader)}” giver anledning til en relevant opfølgning. Afprøv samme konkrete læserbehov i en ny historie, og følg dens kontaktklik.`;
    if (status.status === 'preliminary') action = 'Lad klikmønstret give idéer til en mulig opfølgning, men vent med at ændre den faste prioritering, til udsendelsen har haft mindst syv dage og tallene er opdateret.';
  }
  let performance = status.message;
  if (status.status === 'available') {
    const delta = click.delta;
    performance = `Klikraten er ${rate(click.current.value)} mod et normalt niveau på ${rate(click.baseline)} (${number(Math.abs(delta))} procentpoint ${delta >= 0 ? 'over' : 'under'}).`;
    if (delta <= -1 && open.delta !== null && open.delta >= -1) {
      performance += ' Åbningerne holder bedre niveau end klikkene. Det peger på at undersøge indholdets relevans og vejen videre fra mailen.';
      action += ' Gør næste skridt tydeligt ved den vigtigste historie, og afprøv én ændring ad gangen.';
    } else if (delta >= 1) performance += ' Udsendelsen skaber mere videreklik end den sammenlignelige historik; indholdet er værd at undersøge for mulige opfølgninger.';
    else if (delta <= -1) performance += ' Responsen ligger lavere end historikken. Undersøg både emnefelt, indhold og udsendelsens formål, før én forklaring vælges.';
    else performance += ' Responsen ligger tæt på historikken. Klikfordelingen er derfor et mere konkret udgangspunkt for næste redaktionelle valg end den samlede rate.';
  }
  if (selected.type === 'Medlemskommunikation') action += ' Vurder også, om informationen kunne bruges direkte i mailen; et klik er ikke altid formålet med medlemsinformation.';
  return { headline, interpretation, action, performance, status, links: links.slice(0, 2), linkCount: links.length, historyCount: history.length, comparisonCount: click.count };
}
