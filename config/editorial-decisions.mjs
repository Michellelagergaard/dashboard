import { isComparableLink } from './measurement-methods.mjs';

// A repeated story occupies one place, using its strongest single-issue result.
export function topPeriodNews(rows, limit = 3) {
  const stories = new Map();
  for (const mailing of rows) for (const item of mailing.content || []) {
    if (!isComparableLink(item) || item.editorial?.kind !== 'news' || !Number.isFinite(item.clicks) || item.clicks <= 0) continue;
    let key;
    try {
      const url = new URL(item.destination);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      for (const name of [...url.searchParams.keys()]) if (/^utm_/i.test(name) || /^(fbclid|gclid)$/i.test(name)) url.searchParams.delete(name);
      url.hostname = url.hostname.replace(/^www\./, '');
      url.pathname = url.pathname.replace(/\/$/, '') || '/';
      url.searchParams.sort();
      key = url.href;
    } catch { continue; }
    const previous = stories.get(key);
    if (!previous || item.clicks > previous.item.clicks || (item.clicks === previous.item.clicks && Date.parse(mailing.sentAt) > Date.parse(previous.mailing.sentAt))) stories.set(key, { item, mailing });
  }
  return [...stories.values()].sort((a, b) => b.item.clicks - a.item.clicks || a.item.destination.localeCompare(b.item.destination)).slice(0, limit);
}
