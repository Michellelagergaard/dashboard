import { memberSegmentNames } from './member-segments.mjs';
import { magazineTopicNames, magazineReviewTopic } from './magazine-topics.mjs';
const views = ['home','overview','audiences','mailing','about','competence','magazine','tr-amr','network','member-communication'];
export const periods = { '6m': 'Seneste 6 måneder', '12m': 'Seneste 12 måneder', all: 'Alle år' };
export const defaultDashboardRoute = { view: 'home', period: periods['12m'], mailingId: '', audience: memberSegmentNames[0], topic: '', ranking: 'clicks' };
export function normalizeDashboardRoute(input = {}) {
  return { view: views.includes(input.view) ? input.view : 'home', period: Object.values(periods).includes(input.period) ? input.period : periods['12m'], mailingId: /^[A-Za-z0-9_-]{1,100}$/.test(input.mailingId || '') ? input.mailingId : '', audience: memberSegmentNames.includes(input.audience) ? input.audience : memberSegmentNames[0], topic: [...magazineTopicNames, magazineReviewTopic].includes(input.topic) ? input.topic : '', ranking: input.ranking === 'rate' ? 'rate' : 'clicks' };
}
export function parseDashboardRoute(search = '') {
  const params = new URLSearchParams(search);
  return normalizeDashboardRoute({ view: params.get('page'), period: periods[params.get('period')], mailingId: params.get('issue'), audience: params.get('audience'), topic: params.get('topic'), ranking: params.get('rank') });
}
export function dashboardRouteUrl(currentUrl, input) {
  const route = normalizeDashboardRoute(input), url = new URL(currentUrl);
  const version = url.searchParams.get('v'); url.search = ''; url.hash = '';
  if (version && /^[a-z0-9-]{1,40}$/i.test(version)) url.searchParams.set('v', version);
  url.searchParams.set('page', route.view);
  url.searchParams.set('period', Object.keys(periods).find(key => periods[key] === route.period));
  if (route.mailingId && ['mailing','audiences','competence','magazine','tr-amr','network','member-communication'].includes(route.view)) url.searchParams.set('issue', route.mailingId);
  if (route.view === 'audiences') url.searchParams.set('audience', route.audience);
  if (route.view === 'magazine') { if (route.topic) url.searchParams.set('topic',route.topic); if (route.ranking === 'rate') url.searchParams.set('rank','rate'); }
  return url.pathname + url.search;
}
export function viewForNewsletter(type) {
  return { 'Psykologernes Nyhedsbrev': 'mailing', Kompetencenyt: 'competence', 'Magasinet P': 'magazine', 'TR/AMR Nyt': 'tr-amr', 'Netværksnyt': 'network', Medlemskommunikation: 'member-communication' }[type] || 'home';
}
