"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, AlertCircle, ChevronDown, ChevronRight, ChevronUp, CircleHelp, ClipboardList, Mail, MousePointerClick, Send, TrendingUp, Users } from "lucide-react";
import type { ClickMeasurement, EditorialMetadata, LiveDashboardData, LiveMailing } from "./live-data";
import { EditorialProvider } from "./editorial-editor";
import { enrichMailings } from "../config/editorial-content.mjs";
import { memberSegmentNames } from "../config/member-segments.mjs";
import { editorialCategory, summarizeEditorialTopics } from "../config/editorial-topics.mjs";
import { clickMeasurementLabel, isComparableLink } from "../config/measurement-methods.mjs";
import { normalLevel } from "../config/decision-methods.mjs";

type View = "overview" | "audiences" | "mailing" | "about" | "competence";
type Mailing = LiveMailing;

const segments = memberSegmentNames;
const pct = (value: number) => `${value.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %`;
const num = (value: number) => value.toLocaleString("da-DK");
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function Dashboard({ liveData }: { liveData: LiveDashboardData }) {
  return <EditorialProvider>{corrections => <DashboardContent liveData={{ ...liveData, mailings: enrichMailings(liveData.mailings, corrections) }} />}</EditorialProvider>;
}

function DashboardContent({ liveData }: { liveData: LiveDashboardData }) {
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState("Seneste 12 måneder");
  const mailings = useMemo(
    () => [...liveData.mailings].filter((mailing) => inPeriod(mailing, period)).sort((a, b) => sentTime(b) - sentTime(a)),
    [liveData.mailings, period],
  );
  const newsletterMailings = useMemo(() => mailings.filter((mailing) => mailing.type === "Psykologernes Nyhedsbrev"), [mailings]);
  const competenceMailings = useMemo(() => mailings.filter((mailing) => mailing.type === "Kompetencenyt"), [mailings]);
  const [selectedId, setSelectedId] = useState("");
  const selected = newsletterMailings.find((mailing) => mailing.id === selectedId) || newsletterMailings[0];
  const updated = liveData.updatedAt
    ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(new Date(liveData.updatedAt))
    : "Ikke tilgængelig";

  function openMailing(id?: string) {
    if (id) setSelectedId(id);
    setView("mailing");
  }

  return <div className="app-shell simple-dashboard">
    <a className="skip-link" href="#main">Gå til indhold</a>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark" aria-hidden="true">dp</div><div><strong>Dansk Psykolog<br />Forening</strong><span>Udsendelsesdashboard</span></div></div>
      <nav aria-label="Primær navigation">
        <p className="nav-kicker">Redaktionelt dashboard</p>
        <Nav active={view === "overview"} onClick={() => setView("overview")} icon={<Send />} label="Psykologernes Nyhedsbrev" />
        <div className="nav-subpages" aria-label="Undersider til Psykologernes Nyhedsbrev">
          <Nav nested active={view === "mailing"} onClick={() => setView("mailing")} icon={<ClipboardList />} label="Redaktionel analyse" />
          <Nav nested active={view === "audiences"} onClick={() => setView("audiences")} icon={<Users />} label="Målgrupper" />
          <Nav nested active={view === "about"} onClick={() => setView("about")} icon={<CircleHelp />} label="Om tallene" />
        </div>
        <Nav active={view === "competence"} onClick={() => setView("competence")} icon={<Activity />} label="Kompetencenyt" />
      </nav>
      <div className="sidebar-footer"><div className="sidebar-note"><span className="status-dot" />{liveData.status === "live" ? "Opdateres fra Ungapped" : "Seneste tilgængelige data"}<span className="sidebar-updated">{updated}</span></div></div>
    </aside>
    <main id="main" className="main">
      <header className="topbar"><div><p className="eyebrow">Analyse af medlemskommunikation</p><h1>{view === "overview" ? "Psykologernes Nyhedsbrev" : view === "audiences" ? "Målgrupper" : view === "mailing" ? "Redaktionel analyse" : view === "competence" ? "Kompetencenyt" : "Om tallene"}</h1></div><div className="sync-box"><div><span>Senest opdateret</span><strong>{updated}</strong></div></div></header>
      {view !== "overview" ? <section className="filters simple-filters" aria-label="Filtre"><div className="filter-main"><label><span>Periode</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Seneste 12 måneder</option><option>Seneste 6 måneder</option><option>Alle år</option></select></label></div><p className="filter-result"><strong>{num(view === "competence" ? competenceMailings.length : newsletterMailings.length)}</strong> udsendelser med tagget {view === "competence" ? "Kompetencenyt" : "Psykologernes Nyhedsbrev"}</p></section> : null}
      {view === "audiences" ? <MeasurementGuide /> : null}
      {liveData.status === "unavailable" ? <Empty title="Data er ikke tilgængelige" text="Den seneste dataopdatering kunne ikke læses. Prøv igen senere." /> : null}
      {liveData.status !== "unavailable" && view === "overview" ? <Overview rows={newsletterMailings} onOpen={openMailing} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && view === "audiences" ? <AudienceView rows={newsletterMailings} onOpen={openMailing} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && view === "mailing" ? <MailingView rows={newsletterMailings} selected={selected} onChange={setSelectedId} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && view === "about" ? <AboutNumbers rows={newsletterMailings} /> : null}
      {liveData.status !== "unavailable" && view === "competence" ? <CompetenceOverview rows={competenceMailings} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
    </main>
  </div>;
}

function CompetenceOverview({ rows, asOf }: { rows: Mailing[]; asOf: string }) {
  const latest = rows[0];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se Kompetencenyt." />;
  const averageOpenRate = average(rows.map(row => row.openRate));
  const averageClickRate = average(rows.map(row => row.clickRate));
  const comparison = normalLevel(rows, latest, { metric: "clickRate", asOf });
  const openComparison = normalLevel(rows, latest, { metric: "openRate", asOf });
  const topLinks = latest.content
    .filter(item => item.clickMeasurement?.metric === "unique-contacts")
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);
  const verdict = comparison.delta === null ? "Resultatet kan endnu ikke sammenlignes" : comparison.delta >= 1 ? "Klikraten er højere end det tidligere niveau" : comparison.delta <= -1 ? "Klikraten er lavere end det tidligere niveau" : "Klikraten er på niveau med tidligere udsendelser";
  const verdictNote = comparison.delta === null ? "Der er endnu ikke tilstrækkeligt sammenligningsgrundlag." : `Klikraten afviger med ${formatPoint(Math.abs(comparison.delta))} procentpoint fra medianen for ${comparison.count} tidligere udsendelser. Åbningsraten er ${comparisonPhrase(openComparison.delta)}.`;
  return <div className="stack overview-page competence-page">
    <PeriodAverageChart openRate={averageOpenRate} clickRate={averageClickRate} count={rows.length} />
    <section className={`overview-verdict ${comparison.delta !== null && comparison.delta < -1 ? "below" : "above"}`}>
      <div className="overview-verdict-content"><p className="eyebrow">Seneste udsendelse · {latest.date}</p><h2>{latest.subject || latest.title}</h2><div className="overview-assessment"><span>Vurdering</span><h3>{verdict}</h3><p>{verdictNote}</p></div></div>
      <strong>{comparison.delta === null ? "Afventer grundlag" : comparison.delta >= 1 ? "↑ Klik højere" : comparison.delta <= -1 ? "↓ Klik lavere" : "→ Klik på niveau"}</strong>
    </section>
    <section className="kpi-grid competence-kpis" aria-label="Nøgletal for seneste Kompetencenyt">
      <Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note="Registreret som leveret" />
      <Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} note={levelText(openComparison.delta)} />
      <Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} note={levelText(comparison.delta)} />
      <Kpi icon={<TrendingUp />} label="CTOR" value={latest.openRate > 0 ? pct(latest.clickRate / latest.openRate * 100) : "—"} note="Klik blandt registrerede åbninger" />
      <Kpi icon={<Users />} label="Afmeldinger" value={num(latest.unsubscribes || 0)} note="Registreret efter udsendelsen" />
    </section>
    <section className="overview-section"><div className="overview-section-header"><div><h2>Mest besøgte links</h2><p>De fem destinationslinks med flest unikke klik i Ungapped.</p></div></div><div className="overview-stories">{topLinks.length ? topLinks.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{String(editorialCategory(item))}</span></div><div><strong>{num(item.clicks)} unikke klik</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede linkresultater" text="Ungapped leverede ikke brugbare unikke klik pr. link for denne udsendelse." />}</div></section>
    <OverviewTrend rows={rows} latest={latest} baseline={comparison.baseline} />
    <section className="panel table-panel overview-recent"><div className="overview-section-header"><div><h2>Seneste udsendelser</h2><p>Udviklingen i Kompetencenyt måned for måned. Sammenligningen viser hver måling i forhold til op til fem tidligere udsendelser.</p></div></div><div className="table-scroll"><table><thead><tr><th>Dato og emnefelt</th><th>Sammenligning med tidligere</th><th>Leverede</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th></tr></thead><tbody>{rows.slice(0, 12).map((row) => { const clickLevel = normalLevel(rows, row, { metric: "clickRate", asOf }); const rowOpenLevel = normalLevel(rows, row, { metric: "openRate", asOf }); return <tr key={row.id}><td><strong>{row.date} · {row.subject || row.title}</strong></td><td><CompetenceComparison openDelta={rowOpenLevel.delta} clickDelta={clickLevel.delta} /></td><td>{num(row.delivered)}</td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td>{row.openRate > 0 ? pct(row.clickRate / row.openRate * 100) : "—"}</td></tr>; })}</tbody></table></div></section>
    <details className="panel overview-method"><summary>Om tallene og datagrundlaget</summary><p>Visningen omfatter kun sendte udsendelser med Ungapped-tagget <strong>Kompetencenyt</strong>. Nyhedsbrevet segmenteres ikke, og derfor vises ingen målgruppeanalyse.</p><MeasurementGuideContent /></details>
  </div>;
}

function PeriodAverageChart({ openRate, clickRate, count }: { openRate: number; clickRate: number; count: number }) {
  const metrics = [
    { label: "Gennemsnitlig åbningsrate", value: openRate, className: "open" },
    { label: "Gennemsnitlig klikrate", value: clickRate, className: "click" },
  ];
  return <section className="panel period-average" aria-labelledby="period-average-title">
    <div className="overview-section-header"><div><h2 id="period-average-title">Gennemsnit i den valgte periode</h2><p>Beregnet på tværs af {num(count)} udsendelser med tagget Kompetencenyt.</p></div></div>
    <div className="period-average-chart">{metrics.map(metric => <article key={metric.label} className={metric.className}>
      <div><span>{metric.label}</span><strong>{pct(metric.value)}</strong></div>
      <div className="average-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }} /></div>
    </article>)}</div>
    <p className="method-note">Gennemsnittet er beregnet som et almindeligt gennemsnit af udsendelsernes registrerede rater.</p>
  </section>;
}

function comparisonPhrase(delta: number | null) {
  if (delta === null) return "ikke sammenlignelig endnu";
  if (delta >= 1) return "højere end det tidligere niveau";
  if (delta <= -1) return "lavere end det tidligere niveau";
  return "på niveau med tidligere udsendelser";
}

function CompetenceComparison({ openDelta, clickDelta }: { openDelta: number | null; clickDelta: number | null }) {
  return <div className="competence-comparison"><MetricComparison label="Åbning" delta={openDelta} /><MetricComparison label="Klik" delta={clickDelta} /></div>;
}

function MetricComparison({ label, delta }: { label: string; delta: number | null }) {
  const state = delta === null ? "unknown" : delta >= 1 ? "positive" : delta <= -1 ? "negative" : "neutral";
  const text = delta === null ? "Afventer grundlag" : delta >= 1 ? "Højere" : delta <= -1 ? "Lavere" : "På niveau";
  return <span className={`metric-comparison ${state}`}><b>{label}</b>{text}</span>;
}

function Nav({ active, onClick, icon, label, nested = false }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; nested?: boolean }) {
  return <button className={`nav-item${nested ? " nav-item-nested" : ""}${active ? " active" : ""}`} onClick={onClick}>{icon}<span>{label}</span><ChevronRight /></button>;
}

function Overview({ rows, onOpen, asOf }: { rows: Mailing[]; onOpen: (id: string) => void; asOf: string }) {
  const latest = rows[0];
  const previous = rows[1];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se Psykologernes Nyhedsbrev." />;
  const comparison = normalLevel(rows, latest, { metric: "clickRate", asOf });
  const openComparison = normalLevel(rows, latest, { metric: "openRate", asOf });
  const topLinks = latest.content.filter(item => item.editorial?.kind === "news").sort((a, b) => b.clicks - a.clicks).slice(0, 3);
  const verdict = comparison.delta === null ? "Resultatet kan endnu ikke sammenlignes" : comparison.delta >= 0 ? "Nyhedsbrevet klarede sig bedre end normalt" : "Nyhedsbrevet lå under det normale niveau";
  const verdictNote = comparison.delta === null ? "Der er endnu ikke tilstrækkeligt sammenligningsgrundlag." : `Klikraten var ${formatPoint(Math.abs(comparison.delta))} procentpoint ${comparison.delta >= 0 ? "over" : "under"} niveauet for ${comparison.count} tidligere udsendelser.`;
  const performance = [...segmentRows(latest)].filter(item => Number.isFinite(item.clickRate)).sort((a, b) => b.clickRate - a.clickRate);
  const strongest = performance[0];
  const weakest = performance.at(-1);
  const strongestLink = [...segmentLinkRows(latest)].sort((a, b) => b.clicks - a.clicks)[0];
  return <div className="stack overview-page">
    <section className={`overview-verdict ${comparison.delta !== null && comparison.delta < 0 ? "below" : "above"}`}>
      <div className="overview-verdict-content">
        <p className="eyebrow">Seneste udsendelse · {latest.date}</p>
        <h2>{latest.subject || latest.title}</h2>
        <div className="overview-assessment"><span>Vurdering</span><h3>{verdict}</h3><p>{verdictNote}</p></div>
      </div>
      <strong>{comparison.delta === null ? "Afventer grundlag" : comparison.delta >= 0 ? "↑ Over normalt niveau" : "↓ Under normalt niveau"}</strong>
    </section>
    <section className="kpi-grid overview-kpis" aria-label="Nøgletal for seneste udsendelse">
      <Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note={previous ? `${signed(latest.delivered - previous.delivered)} sammenlignet med sidst` : "Første udsendelse i perioden"} />
      <Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} note={levelText(openComparison.delta)} />
      <Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} note={levelText(comparison.delta)} />
      <Kpi icon={<Users />} label="Afmeldinger" value={num(latest.unsubscribes || 0)} note="Registreret efter udsendelsen" />
    </section>
    <section className="overview-section"><div className="overview-section-header"><div><h2>Hvad interesserede medlemmerne?</h2><p>De mest klikkede nyheder i den seneste udsendelse.</p></div><button className="row-link" onClick={() => onOpen(latest.id)}>Se hele analysen</button></div><div className="overview-stories">{topLinks.length ? topLinks.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{String(editorialCategory(item))}</span></div><div><strong>{num(item.clicks)} klik</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede linkresultater" text="Ungapped leverede ikke brugbare klik pr. nyhed for denne udsendelse." />}</div></section>
    <section className="overview-section"><div className="overview-section-header"><div><h2>Det vigtigste på tværs af målgrupper</h2><p>Dokumenterede observationer fra den seneste udsendelse.</p></div></div><div className="overview-insights">
      {strongest ? <article><TrendingUp /><h3>{strongest.name}</h3><p>Havde udsendelsens højeste klikrate: {pct(strongest.clickRate)}.</p></article> : null}
      {strongestLink ? <article><MousePointerClick /><h3>{strongestLink.audience}</h3><p>Klikkede især på “{displayTitle(strongestLink)}”.</p></article> : null}
      {weakest ? <article><AlertCircle /><h3>{weakest.name}</h3><p>Havde udsendelsens laveste klikrate: {pct(weakest.clickRate)}.</p></article> : null}
    </div></section>
    <OverviewTrend rows={rows} latest={latest} baseline={comparison.baseline} />
    <section className="panel table-panel overview-recent"><div className="overview-section-header"><div><h2>Seneste udsendelser</h2><p>Et kort overblik over udviklingen.</p></div></div><div className="table-scroll"><table><thead><tr><th>Dato og emnefelt</th><th>Vurdering</th><th>Åbnet</th><th>Klikket</th><th></th></tr></thead><tbody>{rows.slice(0, 5).map((row) => { const level = normalLevel(rows, row, { metric: "clickRate", asOf }); return <tr key={row.id}><td><strong>{row.date} · {row.subject || row.title}</strong></td><td><PerformanceBadge delta={level.delta} /></td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td><button className="row-link" onClick={() => onOpen(row.id)}>Åbn</button></td></tr>; })}</tbody></table></div></section>
    <details className="panel overview-method"><summary>Om tallene og datagrundlaget</summary><MeasurementGuideContent /><CoverageSummary rows={rows} /></details>
  </div>;
}

function AudienceView({ rows, onOpen, asOf }: { rows: Mailing[]; onOpen: (id: string) => void; asOf: string }) {
  const [audience, setAudience] = useState(segments[0]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const availableSegments = segments.filter((name) => rows.some((mailing) => segmentRows(mailing).some((item) => item.name === name)));
  const selectedAudience = availableSegments.includes(audience) ? audience : availableSegments[0] || audience;
  const series = rows.map((mailing) => ({ mailing, data: segmentRows(mailing).find((item) => item.name === selectedAudience) })).filter((item): item is { mailing: Mailing; data: NonNullable<LiveMailing["segmentPerformance"]>[number] } => Boolean(item.data));
  const links = rows.flatMap((mailing) => segmentLinkRows(mailing).filter((item) => item.audience === selectedAudience).map((item) => ({ ...item, mailing }))).sort((a, b) => b.clicks - a.clicks);
  const linkCoverage = new Set(links.map((item) => item.mailing.id)).size;
  const latest = series[0];
  const level = latest ? normalLevel(rows, latest.mailing, { audience: selectedAudience, metric: "clickRate", asOf }) : null;
  const verdict = !level || level.delta === null ? "Resultatet kan endnu ikke sammenlignes" : level.delta >= 1 ? "Målgruppen reagerede over sit normale niveau" : level.delta <= -1 ? "Målgruppen reagerede under sit normale niveau" : "Målgruppen reagerede på sit normale niveau";
  const verdictNote = !level || level.delta === null ? "Der er endnu ikke tilstrækkeligt sammenligningsgrundlag." : `Klikraten var ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} medianen for ${level.count} tidligere udsendelser.`;
  const visibleHistory = historyExpanded ? series : series.slice(0, 6);
  const visibleLinks = linksExpanded ? links : links.slice(0, 8);
  function selectAudience(name: string) {
    setAudience(name);
    setHistoryExpanded(false);
    setLinksExpanded(false);
  }
  return <div className="stack newsletter-workspace">
    <section className="newsletter-intro"><div><p className="eyebrow">Psykologernes Nyhedsbrev</p><h2>Følg én målgruppe ad gangen</h2><p>Se udviklingen, de stærkeste historier og de vigtigste redaktionelle signaler.</p></div><div className="segment-coverage"><strong>{series.length} udgaver</strong><span>har brugbare data for den valgte målgruppe</span></div></section>
    <section className="panel audience-picker"><div className="audience-tabs" role="tablist" aria-label="Medlemssegmenter">{segments.map((name) => { const available = availableSegments.includes(name); return <button key={name} role="tab" aria-selected={selectedAudience === name} disabled={!available} title={available ? undefined : "Ingen dokumenterede data i den valgte periode"} className={selectedAudience === name ? "audience-tab selected" : "audience-tab"} onClick={() => selectAudience(name)}><span>{name}</span>{!available ? <small>Ingen data</small> : null}</button>; })}</div></section>
    {latest ? <section className={`audience-verdict ${level?.delta !== null && level && level.delta < -1 ? "below" : "above"}`}><div><p className="eyebrow">{selectedAudience} · seneste udsendelse {latest.mailing.date}</p><h2>{verdict}</h2><p>{verdictNote}</p></div><strong>{!level || level.delta === null ? "Afventer grundlag" : level.delta >= 1 ? "↑ Over normalt niveau" : level.delta <= -1 ? "↓ Under normalt niveau" : "→ På normalt niveau"}</strong></section> : null}
    <section className="kpi-grid audience-kpis"><Kpi icon={<Mail />} label="Udgaver med data" value={num(series.length)} note={`${num(rows.length)} udgaver i perioden`} /><Kpi icon={<Users />} label="Seneste modtagerantal" value={latest ? latest.data.recipientsLabel : "—"} note="Målgruppen i seneste udsendelse" /><Kpi icon={<Activity />} label="Åbningsrate" value={latest ? pct(latest.data.openRate) : "—"} note="Seneste udsendelse" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={latest ? pct(latest.data.clickRate) : "—"} note={levelText(level?.delta ?? null)} /></section>
    {latest ? <AudienceTrend series={series} baseline={level?.baseline ?? null} audience={selectedAudience} /> : null}
    <section className="panel table-panel audience-links"><PanelHeader eyebrow={selectedAudience} title="Hvad interesserede målgruppen?" meta={`${linkCoverage} af ${series.length} udgaver har målgruppefordelte linkklik`} /><p className="content-scope-note">Historier med flest dokumenterede klik i den valgte periode. Visningen dokumenterer ikke, at indholdet kun blev sendt til denne målgruppe.</p><div className="table-scroll"><table><thead><tr><th>Historie eller link</th><th>Emne</th><th>Udsendelse</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{links.length ? visibleLinks.map((item) => <tr key={`${item.mailing.id}-${item.destination}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td>{item.mailing.date}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={5} text="Ingen dokumenterede linkresultater for denne målgruppe i den valgte periode." />}</tbody></table></div>{links.length > 8 ? <ExpandButton expanded={linksExpanded} total={links.length} onClick={() => setLinksExpanded((value) => !value)} /> : null}</section>
    {latest ? <AudienceTakeaways audience={selectedAudience} level={level} top={links[0]} /> : null}
    <details className="panel overview-method"><summary>Se de enkelte udsendelser og datagrundlaget</summary><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th></th></tr></thead><tbody>{series.length ? visibleHistory.map(({ mailing, data }) => <tr key={mailing.id}><td><strong>{mailing.title}</strong></td><td>{mailing.date}</td><td>{data.recipientsLabel}</td><td>{pct(data.openRate)}</td><td><b>{pct(data.clickRate)}</b></td><td>{pct(data.ctor)}</td><td><button className="row-link" onClick={() => onOpen(mailing.id)}>Åbn</button></td></tr>) : <EmptyRow columns={7} text={`Der er endnu ingen offentliggørelsesklare resultater for ${selectedAudience}.`} />}</tbody></table></div>{series.length > 6 ? <ExpandButton expanded={historyExpanded} total={series.length} onClick={() => setHistoryExpanded((value) => !value)} /> : null}<MeasurementGuideContent /></details>
  </div>;
}

function AudienceTrend({ series, baseline, audience }: { series: Array<{ mailing: Mailing; data: NonNullable<LiveMailing["segmentPerformance"]>[number] }>; baseline: number | null; audience: string }) {
  const chronological = series.slice(0, 6).reverse();
  const values = chronological.map(item => item.data.clickRate);
  const upper = Math.max(20, Math.ceil(Math.max(...values, baseline || 0) / 5) * 5);
  const x = (index: number) => chronological.length === 1 ? 50 : 6 + index * (88 / (chronological.length - 1));
  const y = (value: number) => 88 - value / upper * 70;
  const points = chronological.map((item, index) => `${x(index)},${y(item.data.clickRate)}`).join(" ");
  return <section className="panel overview-trend audience-trend"><div className="overview-section-header"><div><h2>Udvikling i klikrate</h2><p>De seneste {chronological.length} udsendelser for {audience}.</p></div></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Klikrate for ${audience} i de seneste ${chronological.length} udsendelser.`}><line x1="6" y1="88" x2="94" y2="88" className="trend-axis" />{baseline !== null ? <line x1="6" y1={y(baseline)} x2="94" y2={y(baseline)} className="trend-baseline" /> : null}<polyline points={points} className="trend-line" />{chronological.map((item, index) => <circle key={item.mailing.id} cx={x(index)} cy={y(item.data.clickRate)} r={index === chronological.length - 1 ? 2.2 : 1.5} className="trend-point"><title>{item.mailing.date}: {pct(item.data.clickRate)}</title></circle>)}</svg><div className="trend-labels">{chronological.map(item => <span key={item.mailing.id}>{item.mailing.date.replace(/\. 2026$/, ".")}</span>)}</div>{baseline !== null ? <p className="trend-note"><span />Normalt niveau for målgruppen: {pct(baseline)}</p> : null}</section>;
}

function AudienceTakeaways({ audience, level, top }: { audience: string; level: ReturnType<typeof normalLevel> | null; top?: ReturnType<typeof segmentLinkRows>[number] & { mailing: Mailing } }) {
  const comparison = !level || level.delta === null ? "Der er endnu ikke nok sammenlignelige udsendelser til en sikker vurdering." : `Den seneste klikrate ligger ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} målgruppens normale niveau.`;
  return <section className="panel automatic-takeaways audience-takeaways"><div className="panel-header"><div><p className="eyebrow">Automatisk redaktionel vurdering</p><h2>Hvad tager vi med videre?</h2></div><span>{audience}</span></div><div className="takeaway-grid"><article><span>Det ser ud til at virke</span><h3>{top ? displayTitle(top) : "Afventer linkdata"}</h3><p>{top ? `Historien har flest registrerede klik hos ${audience} i den valgte periode: ${num(top.clicks)}.` : "Der er endnu ikke dokumenterede målgruppeklik at fremhæve."}</p></article><article><span>Hold øje med</span><h3>Er niveauet stabilt?</h3><p>{comparison}</p></article><article><span>Redaktionelt forslag</span><h3>Afprøv det stærkeste greb igen</h3><p>{top ? "Prioritér en ny, konkret historie om samme emne højt, og sammenlign resultatet med målgruppens normale niveau." : "Afprøv én tydelig servicehistorie højt og sammenlign med målgruppens normale niveau."}</p></article></div><p className="method-note">Vurderingen genereres automatisk og beskriver mønstre i tallene. Den dokumenterer ikke årsagen til medlemmernes adfærd.</p></section>;
}

function MailingView({ rows, selected, onChange, asOf }: { rows: Mailing[]; selected?: Mailing; onChange: (id: string) => void; asOf: string }) {
  if (!selected) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode." />;
  const content = [...selected.content].sort((a, b) => b.clicks - a.clicks);
  const news = content.filter((item) => item.editorial?.kind === "news");
  const topStories = news.slice(0, 5);
  const performance = [...segmentRows(selected)].sort((a, b) => b.clickRate - a.clickRate);
  const segmentLinks = segmentLinkRows(selected).sort((a, b) => b.clicks - a.clicks);
  const ctor = selected.openRate ? selected.clickRate / selected.openRate * 100 : 0;
  const level = normalLevel(rows, selected, { metric: "clickRate", asOf });
  const verdict = level.delta === null ? "Resultatet kan endnu ikke sammenlignes" : level.delta >= 1 ? "Udsendelsen klarede sig bedre end normalt" : level.delta <= -1 ? "Udsendelsen lå under sit normale niveau" : "Udsendelsen lå på sit normale niveau";
  const verdictNote = level.delta === null ? "Der er endnu ikke nok sammenlignelige udsendelser." : `Klikraten var ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} medianen for ${level.count} tidligere udsendelser.`;
  return <div className="stack mailing-page">
    <Selection selected={selected} rows={rows} onChange={onChange} />
    <section className={`mailing-verdict ${level.delta !== null && level.delta < -1 ? "below" : "above"}`}><div><p className="eyebrow">{selected.date} · Psykologernes Nyhedsbrev</p><h2>{verdict}</h2><p>{verdictNote}</p></div><PerformanceBadge delta={level.delta} /></section>
    <section className="panel mailing-summary"><PanelHeader eyebrow="Denne udsendelse" title={selected.title} meta={selected.date} /><p className="subject-line"><span>Emnefelt</span>{selected.subject}</p><div className="kpi-grid compact mailing-kpis"><Kpi icon={<Mail />} label="Leverede" value={num(selected.delivered)} note="Mails registreret som leveret" /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(selected.openRate)} note="Registrerede åbninger" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(selected.clickRate)} note={levelText(level.delta)} /><Kpi icon={<TrendingUp />} label="CTOR" value={pct(ctor)} note="Klik blandt registrerede åbninger" /><Kpi icon={<Users />} label="Afmeldinger" value={num(selected.unsubscribes || 0)} note="Registreret efter udsendelsen" /></div></section>
    <MailingTrend rows={rows} selected={selected} baseline={level.baseline} />
    <section className="overview-section"><div className="overview-section-header"><div><h2>Hvad interesserede medlemmerne?</h2><p>De mest klikkede redaktionelle historier i udsendelsen.</p></div></div><div className="overview-stories mailing-stories">{topStories.length ? topStories.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{String(editorialCategory(item))}</span><AudienceExposure item={item} /></div><div><strong>{num(item.clicks)} klik</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede historier" text="Der er ingen brugbare klikresultater for redaktionelle historier i denne udsendelse." />}</div></section>
    <section className="panel table-panel mailing-audiences"><PanelHeader eyebrow="Målgrupper" title="Hvordan reagerede målgrupperne?" meta={performance.length ? `${performance.length} målgrupper med data` : "Ingen målgruppedata"} /><div className="table-scroll"><table><thead><tr><th>Målgruppe</th><th>Emnefelt</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th></tr></thead><tbody>{performance.length ? performance.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{subjectForAudience(selected, item.name) || <span className="muted-cell">Samme eller ikke dokumenteret</span>}</td><td>{item.recipientsLabel}</td><td>{pct(item.openRate)}</td><td><b>{pct(item.clickRate)}</b></td></tr>) : <EmptyRow columns={5} text="Der er ingen brugbare målgrupperesultater for denne udsendelse." />}</tbody></table></div></section>
    <MailingTakeaways selected={selected} level={level} topStory={topStories[0]} performance={performance} />
    <details className="panel overview-method mailing-details"><summary>Se alle linkresultater og datagrundlaget</summary><p className="content-scope-note">Samlede klik i hele udsendelsen uden målgruppefilter vises først. Målgruppefilteret dokumenterer, hvem der klikkede, men ikke at en historie kun blev sendt til den pågældende målgruppe. Målgrupper kan overlappe.</p><h3>Alle linkresultater</h3><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Emne</th><th>Registrerede linkklik</th><th>Klik pr. 100 leverede</th></tr></thead><tbody>{content.length ? content.map((item, index) => <tr key={`${item.destination}-${index}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={4} text="Ingen dokumenterede linkresultater for denne udsendelse." />}</tbody></table></div><h3>Målgruppefordelte linkresultater</h3><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Målgruppe</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{segmentLinks.length ? segmentLinks.map((item, index) => <tr key={`${item.destination}-${item.audience}-${index}`}><td><ContentCell item={item} /></td><td>{item.audience}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={4} text="Ingen dokumenterede målgruppefordelte linkresultater for denne udsendelse." />}</tbody></table></div><MeasurementGuideContent /></details>
  </div>;
}

function MailingTrend({ rows, selected, baseline }: { rows: Mailing[]; selected: Mailing; baseline: number | null }) {
  const chronological = rows.filter(row => sentTime(row) <= sentTime(selected)).slice(0, 6).reverse();
  const values = chronological.map(row => row.clickRate);
  const upper = Math.max(20, Math.ceil(Math.max(...values, baseline || 0) / 5) * 5);
  const x = (index: number) => chronological.length === 1 ? 50 : 6 + index * (88 / (chronological.length - 1));
  const y = (value: number) => 88 - value / upper * 70;
  const points = chronological.map((row, index) => `${x(index)},${y(row.clickRate)}`).join(" ");
  return <section className="panel overview-trend mailing-trend"><div className="overview-section-header"><div><h2>Udvikling i klikrate</h2><p>Udsendelsen sammenlignet med de fem foregående.</p></div></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Klikrate frem til ${selected.date}.`}><line x1="6" y1="88" x2="94" y2="88" className="trend-axis" />{baseline !== null ? <line x1="6" y1={y(baseline)} x2="94" y2={y(baseline)} className="trend-baseline" /> : null}<polyline points={points} className="trend-line" />{chronological.map((row, index) => <circle key={row.id} cx={x(index)} cy={y(row.clickRate)} r={row.id === selected.id ? 2.2 : 1.5} className="trend-point"><title>{row.date}: {pct(row.clickRate)}</title></circle>)}</svg><div className="trend-labels">{chronological.map(row => <span key={row.id}>{row.date.replace(/\. 2026$/, ".")}</span>)}</div>{baseline !== null ? <p className="trend-note"><span />Normalt niveau: {pct(baseline)}</p> : null}</section>;
}

function MailingTakeaways({ selected, level, topStory, performance }: { selected: Mailing; level: ReturnType<typeof normalLevel>; topStory?: Mailing["content"][number]; performance: ReturnType<typeof segmentRows> }) {
  const strongest = performance[0];
  const weakest = performance.at(-1);
  const result = level.delta === null ? "Der er endnu ikke nok historik til en sikker sammenligning." : `Klikraten ligger ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} det normale niveau.`;
  return <section className="panel automatic-takeaways mailing-takeaways"><div className="panel-header"><div><p className="eyebrow">Automatisk redaktionel vurdering</p><h2>Hvad tager vi med videre?</h2></div><span>{selected.date}</span></div><div className="takeaway-grid"><article><span>Det ser ud til at virke</span><h3>{topStory ? displayTitle(topStory) : "Afventer linkdata"}</h3><p>{topStory ? `Udsendelsens mest klikkede redaktionelle historie fik ${num(topStory.clicks)} registrerede klik.` : "Der er ikke et sikkert linkresultat at fremhæve."}</p></article><article><span>Hold øje med</span><h3>{weakest ? `Reaktionen hos ${weakest.name}` : "Sammenligningsgrundlaget"}</h3><p>{weakest ? `${weakest.name} havde den laveste klikrate: ${pct(weakest.clickRate)}. ${result}` : result}</p></article><article><span>Redaktionelt forslag</span><h3>Gentag det stærkeste greb</h3><p>{topStory ? `Afprøv en ny, konkret historie om samme emne som “${displayTitle(topStory)}”, og sammenlign med normalniveauet.` : strongest ? `Undersøg, hvad der gjorde udsendelsen relevant for ${strongest.name}, og afprøv grebet igen.` : "Afprøv én tydelig servicehistorie højt i næste udsendelse."}</p></article></div><p className="method-note">Vurderingen beskriver mønstre i tallene og dokumenterer ikke årsagen til medlemmernes adfærd.</p></section>;
}

function Selection({ selected, rows, onChange }: { selected: Mailing; rows: Mailing[]; onChange: (id: string) => void }) {
  return <section className="panel selection-panel"><label><span>Vælg udsendelse</span><select value={selected.id} onChange={(event) => onChange(event.target.value)}>{rows.map((mailing) => <option key={mailing.id} value={mailing.id}>{mailing.date} · {mailing.title}</option>)}</select></label><div><strong>Psykologernes Nyhedsbrev</strong><span>{num(selected.delivered)} leverede · {pct(selected.clickRate)} klikrate</span></div></section>;
}

function AudienceExposure({ item }: { item: Mailing["content"][number] }) {
  const scope = item.editorial?.audienceScope;
  const audiences = item.editorial?.audiences || [];
  const label = scope === "all" ? "Alle modtagere" : scope === "targeted" && audiences.length ? audiences.join(", ") : "Modtagergruppe ikke dokumenteret";
  return <span className={`audience-exposure ${scope === "targeted" ? "targeted" : scope === "all" ? "all" : "unknown"}`}><Users />Modtagere: {label}</span>;
}

function EditorialIntelligence({ rows }: { rows: Mailing[] }) {
  const coveredRows = rows.map(row => ({ ...row, content: row.content.filter(item => isComparableLink(item) && item.editorial?.kind === "news") })).filter(row => row.content.length);
  const topics = summarizeEditorialTopics(coveredRows);
  const latest = coveredRows[0];
  const latestTopics = latest ? summarizeEditorialTopics([latest]) : [];
  const leading = topics.find((topic) => topic.category !== "Andet");
  const latestLeading = latestTopics.find((topic) => topic.category !== "Andet") || latestTopics[0];
  const other = topics.find((topic) => topic.category === "Andet");
  const displayTopics = [...topics.filter((topic) => topic.category !== "Andet"), ...(other ? [other] : [])];
  const totalLinks = topics.reduce((sum, topic) => sum + topic.links, 0);
  return <section className="panel editorial-intelligence"><PanelHeader eyebrow="Redaktionel intelligens" title="Hvad viser de dokumenterede klik?" meta={`${coveredRows.length} af ${rows.length} udgaver har dokumenteret kontaktmål`} />{leading && latestLeading ? <><div className="editorial-conclusions"><article><span>Seneste udgave med linkdata</span><strong>{latestLeading.category}</strong><p>fik flest registrerede linkklik blandt de navngivne emner: {num(latestLeading.clicks)} klik fordelt på {num(latestLeading.links)} link{latestLeading.links === 1 ? "" : "s"}.</p></article><article><span>Hele den valgte periode</span><strong>{leading.category}</strong><p>har flest registrerede linkklik blandt de navngivne emner: {num(leading.clicks)} klik i {num(leading.mailings)} udgave{leading.mailings === 1 ? "" : "r"} med tilgængelige linkdata.</p></article></div><div className="topic-summary" role="list" aria-label="Redaktionelle emnekategorier">{displayTopics.slice(0, 7).map((topic) => <div key={topic.category} role="listitem"><TopicBadge category={topic.category} /><strong>{num(topic.clicks)} klik</strong><span>{num(topic.links)} links · {num(topic.mailings)} udgaver</span></div>)}</div><p className="method-note">Konklusionerne bruger historier med et dokumenteret og sammenligneligt kontaktmål. Tekniske og administrative links indgår ikke. Emnerne er automatiske forslag. Historiske klikmål uden gemt feltdefinition indgår ikke. Summer er ikke unikke personer på tværs af links; gentagne linkplaceringer kan være angivet som et minimum. Konklusionerne beskriver registreret klikvolumen og dokumenterer ikke, hvorfor medlemmerne klikkede. {other ? `${num(other.links)} af ${num(totalLinks)} linkresultater kunne ikke kategoriseres sikkert og står som Andet.` : "Alle viste linkresultater kunne placeres i en navngiven kategori."}</p></> : <DataGap title="Ingen dokumenterede konklusioner endnu" text="Redaktionelle konklusioner vises, når mindst én udgave i perioden har brugbare linkklik." />}</section>;
}

function TopicBadge({ item, category }: { item?: { title?: string; destination: string; editorial?: EditorialMetadata }; category?: string }) { return <span className="topic-badge" title={item?.editorial?.source === "editor" ? "Redaktionelt rettet" : "Automatisk emneforslag"}>{category || String(editorialCategory(item!))}</span>; }

function ExpandButton({ expanded, total, onClick }: { expanded: boolean; total: number; onClick: () => void }) { return <button className="expand-table" type="button" aria-expanded={expanded} onClick={onClick}>{expanded ? <><ChevronUp />Vis færre</> : <><ChevronDown />Vis alle {total}</>}</button>; }

function Kpi({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="kpi"><div className="kpi-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small className="neutral">{note}</small></article>; }
function PerformanceBadge({ delta }: { delta: number | null }) {
  const label = delta === null ? "Kan ikke sammenlignes" : delta >= 1 ? "Over normalt" : delta <= -1 ? "Under normalt" : "På normalt niveau";
  return <span className={`performance-badge ${delta === null ? "unknown" : delta >= 1 ? "positive" : delta <= -1 ? "negative" : "neutral"}`}>{label}</span>;
}
function OverviewTrend({ rows, latest, baseline }: { rows: Mailing[]; latest: Mailing; baseline: number | null }) {
  const chronological = rows.slice(0, 6).reverse();
  const values = chronological.map(row => row.clickRate);
  const upper = Math.max(20, Math.ceil(Math.max(...values, baseline || 0) / 5) * 5);
  const x = (index: number) => chronological.length === 1 ? 50 : 6 + index * (88 / (chronological.length - 1));
  const y = (value: number) => 88 - value / upper * 70;
  const points = chronological.map((row, index) => `${x(index)},${y(row.clickRate)}`).join(" ");
  return <section className="panel overview-trend"><div className="overview-section-header"><div><h2>Udvikling i klikrate</h2><p>De seneste {chronological.length} udsendelser sammenlignet med normalt niveau.</p></div></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Klikrate for de seneste ${chronological.length} udsendelser. Seneste udsendelse: ${pct(latest.clickRate)}.`}><line x1="6" y1="88" x2="94" y2="88" className="trend-axis" />{baseline !== null ? <line x1="6" y1={y(baseline)} x2="94" y2={y(baseline)} className="trend-baseline" /> : null}<polyline points={points} className="trend-line" />{chronological.map((row, index) => <circle key={row.id} cx={x(index)} cy={y(row.clickRate)} r={index === chronological.length - 1 ? 2.2 : 1.5} className="trend-point"><title>{row.date}: {pct(row.clickRate)}</title></circle>)}</svg><div className="trend-labels">{chronological.map(row => <span key={row.id}>{row.date.replace(/\. 2026$/, ".")}</span>)}</div>{baseline !== null ? <p className="trend-note"><span />Normalt niveau for seneste udsendelse: {pct(baseline)}</p> : null}</section>;
}
function AboutNumbers({ rows }: { rows: Mailing[] }) {
  return <div className="stack about-page"><section className="panel"><PanelHeader eyebrow="Dokumentation" title="Sådan skal tallene læses" meta="Metode og datadækning" /><MeasurementGuideContent /></section><CoverageSummary rows={rows} /><section className="panel"><PanelHeader eyebrow="Teknisk dokumentation" title="Datakilde og metode" meta="For udvikling og kontrol" /><p>Dashboardet viser dataminimerede og aggregerede resultater fra Ungapped. Ingen kontaktdata publiceres.</p><p><a href="https://github.com/Michellelagergaard/dashboard" target="_blank" rel="noreferrer">Åbn GitHub-repository</a></p></section></div>;
}
function CoverageSummary({ rows }: { rows: Mailing[] }) {
  const values = [
    ["Udsendelsestal", rows.length],
    ["Klik pr. nyhed", rows.filter((row) => coverageFor(row).linkPerformance).length],
    ["Målgruppetal", rows.filter((row) => coverageFor(row).segmentPerformance).length],
    ["Målgruppeklik pr. nyhed", rows.filter((row) => coverageFor(row).segmentLinkPerformance).length],
  ] as const;
  return <section className="panel coverage-panel" aria-label="Datadækning"><div><p className="eyebrow">Datadækning i perioden</p><p>Hver analyse viser kun dokumenterede data fra Ungapped.</p></div><div className="coverage-grid">{values.map(([label, value]) => <div key={label}><strong>{value} af {rows.length}</strong><span>{label}</span></div>)}</div></section>;
}
function MeasurementGuide() {
  return <details className="panel measurement-guide"><summary>Sådan skal tallene læses · historik og målretning</summary><MeasurementGuideContent /></details>;
}
function MeasurementGuideContent() {
  return <div className="measurement-guide-content">
    <p><strong>Modtagere og leveringer:</strong> Modtagere er udsendelsens målgruppe før fradrag af fejlede leveringer og bounces. Leverede er mails registreret som leveret. Summer på tværs af udgaver er ikke unikke personer.</p>
    <p><strong>Målgruppegennemsnit:</strong> Vi vægter efter leveringer, når alle udgaver i beregningen har gemte leveringstal. Ellers viser vi et uvægtet gennemsnit pr. udgave. Vi gætter ikke på historiske leveringstal.</p>
    <p><strong>Klikmål:</strong> Unikke kontakter og samlede klik vises særskilt ved hvert link. Samme person kan klikke på flere links. Når flere linkplaceringer er samlet, vises det højeste dokumenterede kontaktantal som et minimum. Historiske klikmål uden gemt feltdefinition er mærket; de indgår ikke i automatiske emnekonklusioner.</p>
    <p><strong>Rater:</strong> Udsendelsens klikrate følger API’ets registrerede klik i forhold til leverede mails. Linktabellerne viser klik pr. 100 leverede eller modtagere — ikke andelen af dem, der fik vist netop den nyhed. Raterne dokumenterer ikke menneskelige læsere eller klik renset for automatiske systemer.</p>
    <p><strong>Målretning:</strong> Målgruppeklik viser, hvem der har registrerede klik i filteret. De dokumenterer ikke, at nyheden kun blev sendt til den målgruppe. Indholdets eksponering er endnu ikke kortlagt, og målgrupper kan overlappe.</p>
    <p><strong>Historik:</strong> Det er endnu ikke bekræftet, om kontaktfiltre bruger medlemsstatus på afsendelsesdatoen eller ved opslaget. Resultaterne skal derfor ikke læses som en dokumenteret historisk medlemsbestand. Data over en måned gamle bevares som historik; seneste opdatering betyder ikke, at alle historiske tal er genberegnet.</p>
    <p><strong>Metode fra 17. september 2026:</strong> Nye importer gemmer målefelt og beregningsgrundlag. Eksisterende historiske tal bevares. <a href="https://github.com/Michellelagergaard/dashboard/blob/main/docs/measurement-methods.md" target="_blank" rel="noreferrer">Se dokumentation og kendte begrænsninger</a>.</p>
  </div>;
}
function LinkClicks({ item }: { item: { clicks: number; clickMeasurement?: ClickMeasurement } }) {
  return <><b>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)}</b><span>{clickMeasurementLabel(item)}</span></>;
}
function LinkRate({ item }: { item: { rate: number; clickMeasurement?: ClickMeasurement } }) {
  return <>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{pct(item.rate)}{!item.clickMeasurement ? <span>Tidligere beregning</span> : null}</>;
}
function ContentCell({ item }: { item: { title?: string; destination: string; editorial?: EditorialMetadata } }) { return <><strong><a href={item.destination} target="_blank" rel="noreferrer">{displayTitle(item)}</a></strong><span>{shortLink(item.destination)}</span><span className="title-source">{["heading", "styled-heading"].includes(item.editorial?.source || "") ? "Overskrift fra nyhedsbrevet" : "Linktekst · overskrift ikke sikkert fundet"}{item.editorial?.ambiguous ? " · Flere titler til samme adresse" : ""}</span></>; }
function PanelHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) { return <div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>; }
function DataGap({ title, text }: { title: string; text: string }) { return <div className="insight neutral data-gap"><Activity /><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="panel"><DataGap title={title} text={text} /></section>; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td className="empty-cell" colSpan={columns}>{text}</td></tr>; }
function segmentRows(mailing: Mailing) { return mailing.segmentPerformance || []; }
function segmentLinkRows(mailing: Mailing) { return mailing.segmentLinkPerformance || []; }
function subjectForAudience(mailing: Mailing, audience: string) { return mailing.segmentSubjects?.find((item) => item.audience === audience)?.subject; }
function coverageFor(mailing: Mailing) { return mailing.dataCoverage || { linkPerformance: mailing.content.length > 0, segmentPerformance: segmentRows(mailing).length > 0, segmentSubjects: Boolean(mailing.segmentSubjects?.length), segmentLinkPerformance: segmentLinkRows(mailing).length > 0 }; }
function displayTitle(item: { title?: string; destination: string; editorial?: EditorialMetadata }) {
  const title = item.editorial?.title || item.title;
  const genericCta = /^(tilmeld( dig)?|læs mere( og tilmeld dig)?|se mere|klik her)$/i;
  if (title && title !== item.destination && !/^https?:\/\//i.test(title) && !genericCta.test(title.trim())) return title;
  return readableDestinationTitle(item.destination) || shortLink(item.destination);
}

function readableDestinationTitle(destination: string) {
  try {
    const url = new URL(destination);
    const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "")
      .replace(/-\d+$/, "")
      .replaceAll("-", " ")
      .replace(/\bboern\b/gi, "børn")
      .replace(/\boevrige\b/gi, "øvrige")
      .trim();
    return slug ? slug.charAt(0).toLocaleUpperCase("da-DK") + slug.slice(1) : "";
  } catch { return ""; }
}
function sentTime(mailing: Mailing) { return mailing.sentAt ? new Date(mailing.sentAt).getTime() : 0; }
function inPeriod(mailing: Mailing, period: string) { if (period === "Alle år" || !mailing.sentAt) return true; const cutoff = new Date(); cutoff.setUTCMonth(cutoff.getUTCMonth() - (period.includes("6") ? 6 : 12)); return new Date(mailing.sentAt) >= cutoff; }
function signed(value: number) { return `${value >= 0 ? "+" : ""}${num(value)}`; }
function formatPoint(value: number) { return value.toLocaleString("da-DK", { maximumFractionDigits: 1 }); }
function levelText(delta: number | null) { return delta === null ? "Kan endnu ikke sammenlignes" : delta >= 1 ? `${formatPoint(delta)} procentpoint over normalt` : delta <= -1 ? `${formatPoint(Math.abs(delta))} procentpoint under normalt` : "På normalt niveau"; }
function shortLink(destination: string) { try { const url = new URL(destination); return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`; } catch { return destination; } }
