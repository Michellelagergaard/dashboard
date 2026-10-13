"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronUp, CircleHelp, ClipboardList, LayoutDashboard, Mail, MousePointerClick, Network, Send, TrendingUp, Users } from "lucide-react";
import type { ClickMeasurement, EditorialMetadata, LiveDashboardData, LiveMailing } from "./live-data";
import { EditorialProvider } from "./editorial-editor";
import { enrichMailings } from "../config/editorial-content.mjs";
import { memberSegmentNames } from "../config/member-segments.mjs";
import { editorialCategory, summarizeEditorialTopics } from "../config/editorial-topics.mjs";
import { clickMeasurementLabel, isComparableLink, partitionLinkMeasurements, summarizeSegmentRates, summarizeCoverage } from "../config/measurement-methods.mjs";
import { magazineReviewTopic, magazineTopicNames, summarizeMagazineTopics } from "../config/magazine-topics.mjs";
import { dashboardRouteUrl, normalizeDashboardRoute, parseDashboardRoute, viewForNewsletter } from "../config/dashboard-navigation.mjs";
import { editorialDecisionEvidence, editorialTestAction, topPeriodNews } from "../config/editorial-decisions.mjs";
import { normalLevel, comparisonStatus, checkpointStatus } from "../config/decision-methods.mjs";

type View = "home" | "overview" | "audiences" | "mailing" | "about" | "competence" | "magazine" | "tr-amr" | "network";
type Mailing = LiveMailing;

const segments = memberSegmentNames;
const pct = (value: number) => `${value.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %`;
const num = (value: number) => value.toLocaleString("da-DK");
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function Dashboard({ liveData }: { liveData: LiveDashboardData }) {
  return <EditorialProvider>{corrections => <DashboardContent liveData={{ ...liveData, mailings: enrichMailings(liveData.mailings, corrections) }} />}</EditorialProvider>;
}

function DashboardContent({ liveData }: { liveData: LiveDashboardData }) {
  const [route, setRoute] = useState(() => {
    const initial = parseDashboardRoute(typeof window === "undefined" ? "" : window.location.search);
    if (initial.view === "mailing" && !initial.mailingId) {
      initial.mailingId = [...liveData.mailings].filter(mailing => mailing.type === "Psykologernes Nyhedsbrev" && inPeriod(mailing, initial.period, liveData.updatedAt || new Date().toISOString())).sort((a, b) => sentTime(b) - sentTime(a))[0]?.id || "";
    }
    return initial;
  });
  const view = route.view as View;
  const period = route.period;
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  useEffect(() => {
    const restore = () => { setRoute(parseDashboardRoute(window.location.search)); setShareMessage(""); };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const url = dashboardRouteUrl(window.location.href, route);
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [route]);
  function navigate(patch: Partial<typeof route>) {
    const next = normalizeDashboardRoute({ ...route, ...patch });
    const url = dashboardRouteUrl(window.location.href, next);
    if (window.location.pathname + window.location.search + window.location.hash !== url) window.history.pushState(null, "", url);
    setRoute(next); setShareMessage("");
  }
  const setView = (next: View) => navigate({ view: next, mailingId: next === "mailing" ? newsletterMailings[0]?.id || "" : "", topic: "" });
  const setSelectedId = (id: string) => navigate({ mailingId: id });
  const setAudienceMailingId = setSelectedId;
  const mailings = [...liveData.mailings].filter(mailing => inPeriod(mailing, period, liveData.updatedAt || new Date().toISOString())).sort((a, b) => sentTime(b) - sentTime(a));
  const newsletterMailings = mailings.filter(mailing => mailing.type === "Psykologernes Nyhedsbrev");
  const competenceMailings = mailings.filter(mailing => mailing.type === "Kompetencenyt");
  const magazineMailings = mailings.filter(mailing => mailing.type === "Magasinet P");
  const trAmrMailings = mailings.filter(mailing => mailing.type === "TR/AMR Nyt");
  const networkMailings = mailings.filter(mailing => mailing.type === "Netværksnyt");
  const audienceIssueId = view === "audiences" ? route.mailingId : "";
  const audienceMailings = audienceIssueId ? newsletterMailings.filter(mailing => mailing.id === audienceIssueId) : newsletterMailings;
  const selected = route.mailingId ? newsletterMailings.find(mailing => mailing.id === route.mailingId) : newsletterMailings[0];
  const otherViews = ["competence", "magazine", "tr-amr", "network"];
  const viewMailings = view === "competence" ? competenceMailings : view === "magazine" ? magazineMailings : view === "tr-amr" ? trAmrMailings : view === "network" ? networkMailings : newsletterMailings;
  const selectionError = Boolean(route.mailingId && ["mailing", "audiences", ...otherViews].includes(view) && !viewMailings.some(mailing => mailing.id === route.mailingId));
  const missingIssue = liveData.mailings.find(mailing => mailing.id === route.mailingId);
  const shareUrl = typeof window === "undefined" ? "" : new URL(dashboardRouteUrl(window.location.href, view === "mailing" && selected ? { ...route, mailingId: selected.id } : route), window.location.origin).href;
  const updated = liveData.updatedAt
    ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(new Date(liveData.updatedAt))
    : "Ikke tilgængelig";

  function changePeriod(value: string) {
    navigate({ period: value, mailingId: "" });
  }

  function openMailing(id?: string) {
    const mailing = liveData.mailings.find(item => item.id === id);
    if (!mailing) { navigate({ view: "mailing", mailingId: id || "" }); return; }
    navigate({ view: viewForNewsletter(mailing.type), mailingId: mailing.id, period: inPeriod(mailing, period, liveData.updatedAt || new Date().toISOString()) ? period : "Alle år" });
  }

  return <div className="app-shell simple-dashboard">
    <a className="skip-link" href="#main">Gå til indhold</a>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><img src="./favicon.png" alt="" /></div><div><strong>Michelle&apos;s<br />Motherboard</strong><span>Udsendelsesdashboard</span></div></div>
      <nav aria-label="Primær navigation">
        <p className="nav-kicker">Redaktionelt dashboard</p>
        <Nav active={view === "home"} onClick={() => setView("home")} icon={<LayoutDashboard />} label="Forside" />
        <Nav active={view === "overview"} onClick={() => setView("overview")} icon={<Send />} label="Psykologernes Nyhedsbrev" />
        <div className="nav-subpages" aria-label="Undersider til Psykologernes Nyhedsbrev">
          <Nav nested active={view === "mailing"} onClick={() => setView("mailing")} icon={<ClipboardList />} label="Redaktionel analyse" />
          <Nav nested active={view === "audiences"} onClick={() => setView("audiences")} icon={<Users />} label="Målgrupper" />
          <Nav nested active={view === "about"} onClick={() => setView("about")} icon={<CircleHelp />} label="Om tallene" />
        </div>
        <Nav active={view === "competence"} onClick={() => setView("competence")} icon={<Activity />} label="Kompetencenyt" />
        <Nav active={view === "magazine"} onClick={() => setView("magazine")} icon={<BookOpen />} label="Magasinet P" />
        <Nav active={view === "tr-amr"} onClick={() => setView("tr-amr")} icon={<Users />} label="TR/AMR Nyt" />
        <Nav active={view === "network"} onClick={() => setView("network")} icon={<Network />} label="Netværksnyt" />
      </nav>
      <div className="sidebar-footer"><div className="sidebar-note"><span className="status-dot" />{liveData.status === "live" ? "Opdateres fra Ungapped" : "Seneste tilgængelige data"}<span className="sidebar-updated">{updated}</span></div></div>
    </aside>
    <main id="main" className="main">
      <header className="topbar"><div><p className="eyebrow">{view === "home" ? "DP’s nyhedsbreve" : "Analyse af medlemskommunikation"}</p><h1>{view === "home" ? "Overblik over nyhedsbrevene" : view === "overview" ? "Psykologernes Nyhedsbrev" : view === "audiences" ? "Målgrupper" : view === "mailing" ? "Redaktionel analyse" : view === "competence" ? "Kompetencenyt" : view === "magazine" ? "Magasinet P" : view === "tr-amr" ? "TR/AMR Nyt" : view === "network" ? "Netværksnyt" : "Om tallene"}</h1></div><div className="sync-box"><div><span>Senest opdateret</span><strong>{updated}</strong></div><button className="share-analysis-button" onClick={() => setSharing(value => !value)} aria-expanded={sharing}>Del analyse</button></div></header>
      {sharing ? <section className="panel share-analysis"><label><span>Link til denne analyse</span><input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label><button onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setShareMessage("Linket er kopieret med dine analysevalg."); } catch { setShareMessage("Markér og kopiér linket fra feltet."); } }}>Kopiér link</button><p role="status">{shareMessage || "Linket bevarer side, periode, udsendelse og målgruppe samt emnevalg i Magasinet P."}</p></section> : null}
      {view !== "overview" && view !== "home" ? <section className="filters analysis-filters" aria-label="Analysefiltre">
        <div className="analysis-filter-controls">
          <fieldset className="period-toggle"><legend>Periode</legend><div>{["Seneste 6 måneder", "Seneste 12 måneder", "Alle år"].map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => changePeriod(value)}>{value === "Alle år" ? "Alle år" : value === "Seneste 6 måneder" ? "6 måneder" : "12 måneder"}</button>)}</div></fieldset>
          {view === "audiences" || view === "mailing" || otherViews.includes(view) ? <label className="issue-filter"><span>Udsendelse</span><select value={view === "audiences" || otherViews.includes(view) ? route.mailingId : selected?.id || route.mailingId} onChange={event => view === "audiences" ? setAudienceMailingId(event.target.value) : setSelectedId(event.target.value)}>
            {view === "audiences" || otherViews.includes(view) ? <option value="">Alle udsendelser i perioden</option> : null}
            {selectionError ? <option value={route.mailingId}>Den valgte udsendelse er ikke tilgængelig i perioden</option> : null}
            {view === "mailing" && !newsletterMailings.length ? <option value="">Ingen udsendelser i perioden</option> : null}
            {viewMailings.map(mailing => <option key={mailing.id} value={mailing.id}>{mailing.date} · {mailing.subject || mailing.title}</option>)}
          </select></label> : null}
        </div>
        <p className="filter-result" aria-live="polite"><strong>{num(view === "competence" ? competenceMailings.length : view === "magazine" ? magazineMailings.length : view === "tr-amr" ? trAmrMailings.length : view === "network" ? networkMailings.length : newsletterMailings.length)}</strong> udsendelser i {period === "Alle år" ? "hele historikken" : period === "Seneste 6 måneder" ? "de seneste 6 måneder" : "de seneste 12 måneder"}{(view === "audiences" || otherViews.includes(view)) && route.mailingId ? " · Viser én valgt udsendelse" : view === "mailing" && selected ? ` · Viser ${selected.date}` : ""}</p>
      </section> : null}
      {selectionError ? <section className="panel"><DataGap title="Den valgte udsendelse kan ikke vises" text={missingIssue ? "Udsendelsen ligger uden for perioden eller tilhører et andet nyhedsbrev. Der vises ikke en anden udsendelse i dens sted." : "Linkets udsendelse findes ikke i de tilgængelige data. Der vises ikke en anden udsendelse i dens sted."} /><button className="row-link" onClick={() => missingIssue ? navigate({ view: viewForNewsletter(missingIssue.type), period: "Alle år" }) : navigate({ mailingId: "" })}>{missingIssue ? "Vis den valgte udsendelse i hele historikken" : "Vis tilgængelige udsendelser"}</button></section> : null}
      {view === "audiences" ? <MeasurementGuide /> : null}
      {liveData.status === "unavailable" ? <Empty title="Data er ikke tilgængelige" text="Den seneste dataopdatering kunne ikke læses. Prøv igen senere." /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "home" ? <HomeOverview onOpen={openMailing} rows={mailings} period={period} onPeriodChange={changePeriod} asOf={liveData.updatedAt || new Date().toISOString()} onNavigate={setView} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "overview" ? <Overview rows={newsletterMailings} onOpen={openMailing} asOf={liveData.updatedAt || new Date().toISOString()} period={period} onPeriodChange={changePeriod} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "audiences" ? <AudienceView audience={route.audience} onAudienceChange={audience => navigate({ audience })} rows={audienceMailings} comparisonRows={newsletterMailings} singleIssue={Boolean(audienceIssueId)} onOpen={openMailing} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "mailing" ? <MailingView onOpen={openMailing} rows={newsletterMailings} selected={selected} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "about" ? <AboutNumbers rows={newsletterMailings} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "competence" ? <CompetenceOverview selectedId={route.mailingId} onSelect={setSelectedId} rows={competenceMailings} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "magazine" ? <MagazineOverview selectedId={route.mailingId} onSelect={setSelectedId} magazineState={{ ranking: route.ranking, topicFilter: route.topic, onRankingChange: ranking => navigate({ ranking }), onTopicChange: topic => navigate({ topic }) }} rows={magazineMailings} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "tr-amr" ? <TrAmrOverview selectedId={route.mailingId} onSelect={setSelectedId} rows={trAmrMailings} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && !selectionError && view === "network" ? <NetworkOverview selectedId={route.mailingId} onSelect={setSelectedId} rows={networkMailings} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
    </main>
  </div>;
}

const newsletterViews: Array<{ name: Mailing["type"]; view: View; icon: ReactNode; className: string }> = [
  { name: "Psykologernes Nyhedsbrev", view: "overview", icon: <Send />, className: "newsletter" },
  { name: "Kompetencenyt", view: "competence", icon: <Activity />, className: "competence" },
  { name: "Magasinet P", view: "magazine", icon: <BookOpen />, className: "magazine" },
  { name: "TR/AMR Nyt", view: "tr-amr", icon: <Users />, className: "tr-amr" },
  { name: "Netværksnyt", view: "network", icon: <Network />, className: "network" },
];

const externalBenchmarks = {
  associations: { openRate: 33.54, clickRate: 2.68 },
};

function HomeOverview({ rows, period, onPeriodChange, asOf, onNavigate, onOpen }: { onOpen: (id: string) => void; rows: Mailing[]; period: string; onPeriodChange: (period: string) => void; asOf: string; onNavigate: (view: View) => void }) {
  const grouped = newsletterViews.map((item) => {
    const issues = rows.filter((row) => row.type === item.name);
    const latest = issues[0];
    const clickLevel = latest ? normalLevel(issues, latest, { metric: "clickRate", asOf }) : null;
    const openLevel = latest ? normalLevel(issues, latest, { metric: "openRate", asOf }) : null;
    return { ...item, issues, latest, clickLevel, openLevel };
  });
  const recent = rows.filter((row) => newsletterViews.some((item) => item.name === row.type)).slice(0, 5);
  const issueCount = grouped.reduce((sum, group) => sum + group.issues.length, 0);

  return <div className="stack home-page">
    <section className="home-intro panel">
      <div><h2>Hvordan går det med nyhedsbrevene?</h2><p>Se åbninger og klik på tværs af DP’s fem nyhedsbreve. Vælg en periode, eller gå videre til et nyhedsbrev for at undersøge udsendelser, målgrupper og indhold.</p></div>
      <label className="home-period"><span>Periode</span><select value={period} onChange={(event) => onPeriodChange(event.target.value)}><option>Seneste 12 måneder</option><option>Seneste 6 måneder</option><option>Alle år</option></select></label>
      <div className="home-coverage"><strong>{num(issueCount)}</strong><span>udsendelser i perioden</span></div>
    </section>

    <section className="home-status" aria-labelledby="home-status-title">
      <div className="overview-section-header"><div><h2 id="home-status-title">Seneste udsendelse fra hvert nyhedsbrev</h2><p>Se de seneste resultater og hvordan klikraten ligger i forhold til nyhedsbrevets tidligere niveau.</p></div></div>
      <div className="home-status-grid">{grouped.map((group) => group.latest ? <article className={"home-status-card " + group.className} key={group.name}>
        <div className="home-card-heading"><span className="home-card-icon">{group.icon}</span><div><h3>{group.name}</h3><p>Senest udsendt {group.latest.date}</p></div></div>
        <div className="home-card-metrics"><div><span>Åbningsrate</span><strong>{pct(group.latest.openRate)}</strong><small>{countLabel(group.latest.openCount, "åbninger")}</small><small>{levelText(group.openLevel?.delta ?? null)}</small></div><div><span>Klikrate</span><strong>{pct(group.latest.clickRate)}</strong><small>{countLabel(group.latest.clickCount, "klik")}</small><small>{levelText(group.clickLevel?.delta ?? null)}</small></div></div>
        <p className="home-measurement-note">{num(group.latest.delivered)} leverede · {comparisonStatus(group.clickLevel).label}{group.clickLevel?.delta === null ? ` · ${homeComparisonReason(group.clickLevel)}` : ` · ${group.clickLevel?.count} tidligere udsendelser`}</p>
        <div className="home-card-footer"><PerformanceBadge delta={group.clickLevel?.delta ?? null} /><button onClick={() => onNavigate(group.view)}>Se analyse <ArrowRight /></button></div>
      </article> : <article className={"home-status-card empty " + group.className} key={group.name}><div className="home-card-heading"><span className="home-card-icon">{group.icon}</span><div><h3>{group.name}</h3><p>Ingen udsendelser i perioden</p></div></div><button onClick={() => onNavigate(group.view)}>Se side <ArrowRight /></button></article>)}</div>
    </section>

    <BenchmarkOverview grouped={grouped} />

    <HomeRecommendations grouped={grouped} asOf={asOf} onNavigate={onNavigate} onOpen={onOpen} />

    <section className="panel table-panel home-recent" aria-labelledby="home-recent-title">
      <div className="overview-section-header"><div><h2 id="home-recent-title">Seneste udsendelser på tværs</h2><p>De fem seneste udsendelser i den valgte periode.</p></div></div>
      {recent.length ? <div className="table-scroll"><table><thead><tr><th>Dato og nyhedsbrev</th><th>Emnefelt</th><th>Åbnet</th><th>Klikket</th><th></th></tr></thead><tbody>{recent.map((row) => {
        const item = newsletterViews.find((candidate) => candidate.name === row.type);
        return <tr key={row.type + "-" + row.id}><td><span className={"home-type-badge " + (item?.className || "")}>{row.type}</span><small>{row.date}</small></td><td><strong>{row.subject || row.title}</strong></td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td><button className="row-link" onClick={() => onOpen(row.id)}>Åbn</button></td></tr>;
      })}</tbody></table></div> : <DataGap title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se tidligere udsendelser." />}
    </section>
  </div>;
}

function BenchmarkOverview({ grouped }: { grouped: Array<(typeof newsletterViews)[number] & { issues: Mailing[] }> }) {
  const allIssues = grouped.flatMap((group) => group.issues);
  const dpOpen = average(allIssues.map((row) => row.openRate));
  const dpClick = average(allIssues.map((row) => row.clickRate));
  const benchmarkRows = [
    { label: "Klikrate", dp: dpClick, benchmark: externalBenchmarks.associations.clickRate, primary: true },
    { label: "Åbningsrate", dp: dpOpen, benchmark: externalBenchmarks.associations.openRate, primary: false },
  ];
  return <section className="panel benchmark-panel benchmark-compact" aria-labelledby="benchmark-title">
    <div className="benchmark-header"><div><p className="eyebrow">Eksternt benchmark</p><h2 id="benchmark-title">Et pejlemærke udefra</h2><p>Vejledende reference. Målgrupper, udsendelsesformål og målemetoder er forskellige.</p></div><span className="benchmark-verdict">{num(allIssues.length)} udsendelser · blandede målgrupper</span></div>
    <p className="analysis-coverage-note">DP-tallet samler fem forskellige nyhedsbreve og er et uvægtet gennemsnit pr. udsendelse. Brug eget nyhedsbrevs historik til at vurdere udvikling.</p>
    <div className="benchmark-bars">
      {benchmarkRows.map((row) => {
        const scale = Math.max(row.dp, row.benchmark) * 1.08 || 1;
        const delta = row.dp - row.benchmark;
        return <article className={row.primary ? "primary" : ""} key={row.label}>
          <div className="benchmark-metric-heading"><h3>{row.label}</h3><span className={delta >= 0 ? "benchmark-positive" : "benchmark-negative"}>{delta >= 0 ? "+" : ""}{formatPoint(delta)} procentpoint</span></div>
          <div className="benchmark-bar-row"><strong>DP</strong><div className="benchmark-track"><span className="dp-bar" style={{ width: `${row.dp / scale * 100}%` }} /></div><b>{pct(row.dp)}</b></div>
          <div className="benchmark-bar-row"><strong>Reference</strong><div className="benchmark-track"><span className="peer-bar" style={{ width: `${row.benchmark / scale * 100}%` }} /></div><b>{pct(row.benchmark)}</b></div>
          {!row.primary && <p className="benchmark-caveat">Åbningsrater er ikke direkte sammenlignelige på tværs af platforme på grund af bl.a. Apple Mail Privacy Protection.</p>}
        </article>;
      })}
    </div>
    <details className="benchmark-breakdown"><summary>Se nyhedsbreve, kilde og sammenligningsgrundlag</summary><div className="benchmark-table-wrap"><table className="benchmark-table"><thead><tr><th>Nyhedsbrev</th><th>Udsendelser</th><th>Åbnet</th><th>Klikket</th><th>Gns. leverede</th></tr></thead><tbody>{grouped.map((group) => {
      const openRate = average(group.issues.map((row) => row.openRate));
      const clickRate = average(group.issues.map((row) => row.clickRate));
      return <tr key={group.name}><td><strong>{group.name}</strong></td><td>{num(group.issues.length)}</td><td>{group.issues.length ? pct(openRate) : "—"}</td><td><b>{group.issues.length ? pct(clickRate) : "—"}</b></td><td>{group.issues.length ? num(Math.round(average(group.issues.map(row => row.delivered)))) : "—"}</td></tr>;
    })}</tbody></table></div>
    <div className="benchmark-source"><p><strong>Kilde:</strong> Higher Logic, <em>Association Email Benchmark Report 2025–2026</em>. Ca. 1.500 foreninger og nonprofits og mere end 2 mia. mails sendt i 2025.</p><p>DP-tallene er almindelige gennemsnit af {num(allIssues.length)} udsendelser i den valgte periode. Hver udsendelse tæller lige meget, uanset antal leverede. Referencen er ikke dokumenteret beregnet med samme vægtning eller klikdefinition. Forskellen i procentpoint er derfor ikke en kvalitetsvurdering.</p><a href="https://www.higherlogic.com/news/higher-logic-releases-2025-2026-association-email-benchmark-report/" target="_blank" rel="noreferrer">Se benchmarkrapporten</a></div></details>
  </section>;
}

type DecisionEvidence = ReturnType<typeof editorialDecisionEvidence>;
type EvidenceExample = { item: Mailing["content"][number]; mailing: Mailing; topic: string; rank: number };
function EvidenceExamples({ examples, onOpen }: { examples: EvidenceExample[]; onOpen?: (id: string)=>void }) {
  return <details className="decision-examples"><summary>Se {examples.length} konkrete eksempler</summary><ul>{examples.map(example=><li key={example.mailing.id+example.item.destination}><a href={example.item.destination} target="_blank" rel="noreferrer">{displayTitle(example.item)}</a><small>{example.mailing.date} · nr. {example.rank} blandt gemte historier · {example.item.clickMeasurement?.aggregation === "max-per-destination" ? "mindst " : ""}{num(example.item.clicks)} kontakter</small>{onOpen ? <button className="decision-link" onClick={()=>onOpen(example.mailing.id)}>Se udsendelsen <ArrowRight /></button> : null}</li>)}</ul></details>;
}
function SignalCard({ evidence, scope, onOpen }: { evidence: DecisionEvidence; scope: string; onOpen?: (id:string)=>void }) {
  const pattern = evidence.pattern;
  return <article className="decision-card strength"><span className="decision-kicker">{pattern ? "Gentaget signal · til afprøvning" : "Utilstrækkeligt grundlag for gentagelse"}</span><h3>{pattern ? pattern.topic : "Ingen dokumenteret gentagelse endnu"}</h3><p className="decision-newsletter">{scope}</p><p className="decision-evidence">{pattern ? `Emnet er i top tre blandt gemte, kategoriserede historier i ${pattern.count} af ${evidence.matureCovered} udsendelser med brugbare kontaktklik og mindst syv dages alder. Der indgår ${pattern.distinct} forskellige historier.` : "Der kræves mindst tre forskellige historier i top tre over mindst tre udsendelser med brugbare kontaktklik og mindst syv dages alder."}</p><p className="decision-action"><strong>{pattern ? "Afprøv" : "Næste skridt"}</strong>{pattern ? editorialTestAction(pattern.topic) : "Udvid perioden eller følg flere udsendelser. Vælg indhold ud fra målgruppens aktuelle behov, indtil et gentaget signal kan dokumenteres."}</p>{pattern ? <EvidenceExamples examples={pattern.examples} onOpen={onOpen} /> : null}</article>;
}
function DecisionTestGuide() { return <details className="decision-test"><summary><span className="decision-test-icon"><MousePointerClick /></span><span>Sådan følger I en afprøvning</span><ChevronDown /></summary><ol><li><strong>Vælg én ændring</strong><p>Fx rubrik eller CTA til én historie. Hold målgruppe, placering og øvrige forhold så ens som muligt.</p></li><li><strong>Aftal målet på forhånd</strong><p>Følg kontaktklik på det konkrete link og nyhedsbrevets klikrate ved samme alder. Brug gemte 7-dagesmålinger, når de findes.</p></li><li><strong>Vurder efter to udsendelser</strong><p>Hvis målepunkter eller linkdata mangler, er resultatet uafklaret. To udsendelser dokumenterer ikke alene en effekt.</p></li></ol></details>; }
function EditorialDecisionSupport({ rows, selected, asOf, audience = "", onOpen }: { rows: Mailing[]; selected: Mailing; asOf: string; audience?: string; onOpen?: (id: string)=>void }) {
  const evidence = editorialDecisionEvidence(rows,{selected,asOf,audience});
  return <section className="panel automatic-takeaways evidence-decisions"><div className="panel-header"><div><p className="eyebrow">Redaktionel beslutningsstøtte</p><h2>Hvad er næste skridt?</h2></div><span>{audience || selected.type}</span></div><p className="analysis-coverage-note">Historik frem til {selected.date} i den valgte periode · {evidence.covered} af {evidence.total} udsendelser har brugbare, kategoriserede kontaktklik · {evidence.matureCovered} er mindst syv dage gamle.</p><div className="decision-cards"><article className="decision-card"><span className="decision-kicker">{evidence.preliminary ? "Foreløbig observation" : "Observation fra valgt udsendelse"}</span><h3>{evidence.current ? displayTitle(evidence.current.item) : "Ingen brugbar historie at fremhæve"}</h3><p className="decision-evidence">{evidence.current ? `${num(evidence.current.item.clicks)} dokumenterede kontakter${evidence.current.item.clickMeasurement?.aggregation === "max-per-destination" ? " som minimum" : ""} · flest blandt de gemte, kategoriserede historier${audience ? ` for ${audience}` : ""}.` : "Historiske klikmål, servicelinks og uklare emner kan ikke begrunde et redaktionelt forslag."}</p><p className="decision-action"><strong>Næste skridt</strong>{evidence.current ? "Læs historien og vurder dens medlemsværdi. En topscorer alene viser ikke, hvilket greb der skabte klik." : "Kontrollér linkdata og emneinddeling før prioritering."}</p>{evidence.current ? <a className="decision-link" href={evidence.current.item.destination} target="_blank" rel="noreferrer">Læs historien <ArrowRight /></a> : null}</article><SignalCard evidence={evidence} scope={audience || selected.type} onOpen={onOpen} /></div><DecisionTestGuide /><p className="method-note">Emner er forslag, som skal vurderes redaktionelt. Historier med ukendt emne eller måletype er udeladt. Top tre gælder gemte historier; flere historier om et emne og forskellig eksponering kan påvirke billedet. Gentagelse dokumenterer ikke årsag eller læsning.</p></section>;
}
function HomeRecommendations({ grouped, asOf, onNavigate, onOpen }: { grouped: Array<(typeof newsletterViews)[number] & { issues: Mailing[]; latest?: Mailing; clickLevel: ReturnType<typeof normalLevel> | null }>; asOf: string; onNavigate: (view: View) => void; onOpen: (id: string)=>void }) {
  const available = grouped.filter(group=>group.latest);
  if (!available.length) return null;
  const target = available.filter(group=>group.clickLevel?.delta != null && group.clickLevel.delta<=-1).sort((a,b)=>(a.clickLevel?.delta || 0)-(b.clickLevel?.delta || 0))[0];
  const candidates = available.map(group=>({group,evidence:editorialDecisionEvidence(group.issues,{asOf})}));
  const signal = [...candidates].filter(row=>row.evidence.pattern).sort((a,b)=>b.evidence.pattern.count-a.evidence.pattern.count)[0] || candidates[0];
  return <section className="panel recommendation-panel recommendation-compact" aria-labelledby="recommendation-title"><div className="overview-section-header"><div><p className="eyebrow">Beslutningsstøtte</p><h2 id="recommendation-title">To næste skridt</h2><p>Vælg en opgave, og se de konkrete udsendelser bag signalet.</p></div></div><div className="decision-cards"><article className="decision-card attention"><span className="decision-kicker">Undersøg</span><h3>{target ? `Fald i ${target.name}` : "Afvent et tydeligt signal om fald"}</h3><p className="decision-evidence">{target ? `${formatPoint(Math.abs(target.clickLevel!.delta!))} procentpoint under medianen for ${target.clickLevel!.count} egne tidligere udsendelser. Seneste udsendelse: ${target.latest!.date}.` : "Ingen af de seneste sammenlignelige udsendelser ligger mindst ét procentpoint under eget niveau."}</p><p className="decision-action"><strong>Næste skridt</strong>{target ? "Sammenlign udsendelsens top tre historier med den foregående: skiftede emner, målgruppe eller tilbud? Vælg én forskel at undersøge." : "Følg foreløbige tal, når de er mindst syv dage gamle. Vælg derefter ud fra nyhedsbrevets egen historik."}</p><button className="decision-link" onClick={()=>target ? onOpen(target.latest!.id) : onNavigate("overview")}>{target ? `Åbn udsendelsen · ${target.latest!.date}` : "Se Psykologernes Nyhedsbrev"} <ArrowRight /></button></article><SignalCard evidence={signal.evidence} scope={signal.group.name} onOpen={onOpen} /></div><DecisionTestGuide /><p className="method-note">Signalet beskriver gentagelser inden for samme nyhedsbrev. Det er ikke en kvalitetsrangering mellem nyhedsbreve. Emnemængde og eksponering kan påvirke billedet; gentagelse dokumenterer ikke årsag.</p></section>;
}

type NewsletterSelectionProps = { rows: Mailing[]; asOf: string; selectedId?: string; onSelect?: (id: string) => void; magazineState?: MagazineTopicControls };
type MagazineTopicControls = { ranking?: string; topicFilter?: string; onRankingChange?: (value: string) => void; onTopicChange?: (value: string) => void };
function CompetenceOverview(props: NewsletterSelectionProps) { return <UnsegmentedNewsletterOverview {...props} name="Kompetencenyt" />; }
function MagazineOverview(props: NewsletterSelectionProps) { return <UnsegmentedNewsletterOverview {...props} name="Magasinet P" />; }
function TrAmrOverview(props: NewsletterSelectionProps) { return <UnsegmentedNewsletterOverview {...props} name="TR/AMR Nyt" />; }
function NetworkOverview(props: NewsletterSelectionProps) { return <UnsegmentedNewsletterOverview {...props} name="Netværksnyt" />; }

function UnsegmentedNewsletterOverview({ rows, asOf, name, selectedId, onSelect, magazineState }: NewsletterSelectionProps & { name: "Kompetencenyt" | "Magasinet P" | "TR/AMR Nyt" | "Netværksnyt" }) {
  const latest = selectedId ? rows.find(row => row.id === selectedId) : rows[0];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text={`Vælg en længere periode for at se ${name}.`} />;
  const averageOpenRate = average(rows.map(row => row.openRate));
  const averageClickRate = average(rows.map(row => row.clickRate));
  const comparison = normalLevel(rows, latest, { metric: "clickRate", asOf });
  const openComparison = normalLevel(rows, latest, { metric: "openRate", asOf });
  const topLinks = latest.content
    .filter(item => item.clickMeasurement?.metric === "unique-contacts")
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);
  const verdict = comparison.delta === null ? "Resultatet kan endnu ikke sammenlignes" : comparison.delta >= 1 ? "Klikraten er højere end det tidligere niveau" : comparison.delta <= -1 ? "Klikraten er lavere end det tidligere niveau" : "Klikraten er på niveau med tidligere udsendelser";
  const verdictNote = comparison.delta === null ? comparisonStatus(comparison).message : `Klikraten afviger med ${formatPoint(Math.abs(comparison.delta))} procentpoint fra medianen for ${comparison.count} tidligere udsendelser. Åbningsraten er ${comparisonPhrase(openComparison.delta)}.`;
  return <div className="stack overview-page competence-page">
    <PeriodAverageChart openRate={averageOpenRate} clickRate={averageClickRate} count={rows.length} tag={name} />
    <section className={`overview-verdict ${comparison.delta === null ? "pending" : comparison.delta <= -1 ? "below" : "above"}`}>
      <div className="overview-verdict-content"><p className="eyebrow">{selectedId ? "Valgt udsendelse" : "Seneste udsendelse"} · {latest.date}</p><h2>{latest.subject || latest.title}</h2><div className="overview-assessment"><span>Vurdering</span><h3>{verdict}</h3><p>{verdictNote}</p></div></div>
      <strong>{comparison.delta === null ? comparisonStatus(comparison).label : comparison.delta >= 1 ? "↑ Klik højere" : comparison.delta <= -1 ? "↓ Klik lavere" : "→ Klik på niveau"}</strong>
    </section>
    <MeasurementContext mailing={latest} level={comparison} asOf={asOf} /><CoverageSummary rows={rows} />
    <section className="kpi-grid competence-kpis" aria-label={`Nøgletal for ${selectedId ? "valgte" : "seneste"} ${name}`}>
      <Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note="Registreret som leveret" />
      <Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} count={countLabel(latest.openCount, "åbninger")} note={levelText(openComparison.delta)} />
      <Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} count={countLabel(latest.clickCount, "klik")} note={levelText(comparison.delta)} />
      <Kpi icon={<TrendingUp />} label="CTOR" value={latest.openRate > 0 ? pct(latest.clickRate / latest.openRate * 100) : "—"} note="Klik blandt registrerede åbninger" />
      <Kpi icon={<Users />} label="Afmeldinger" value={num(latest.unsubscribes || 0)} note="Registreret efter udsendelsen" />
    </section>
    <EditorialDecisionSupport rows={rows} selected={latest} asOf={asOf} onOpen={onSelect} />
    {name === "Magasinet P" ? <MagazineTopics rows={selectedId ? [latest] : rows} {...magazineState} /> : null}
    <section className="overview-section"><div className="overview-section-header"><div><h2>Mest klikkede links</h2><p>De fem gemte destinationslinks med flest dokumenterede kontaktklik.</p></div></div><div className="overview-stories">{topLinks.length ? topLinks.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{contentTopic(item)}</span></div><div><strong>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)} kontakter</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede linkresultater" text="Ungapped leverede ikke brugbare unikke klik pr. link for denne udsendelse." />}</div></section>
    {name === "Kompetencenyt" || name === "Magasinet P" ? <UnsegmentedAudienceClicks rows={selectedId ? [latest] : rows} name={name} singleIssue={Boolean(selectedId)} /> : null}
    <OverviewTrend rows={rows} latest={latest} baseline={comparison.delta === null ? null : comparison.baseline} />
    <section className="panel table-panel overview-recent"><div className="overview-section-header"><div><h2>Seneste udsendelser</h2><p>Udviklingen i {name} måned for måned. Sammenligningen viser hver måling i forhold til op til fem tidligere udsendelser.</p></div></div><div className="table-scroll"><table><thead><tr><th>Dato og emnefelt</th><th>Sammenligning med tidligere</th><th>Leverede</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th></th></tr></thead><tbody>{rows.slice(0, 12).map((row) => { const clickLevel = normalLevel(rows, row, { metric: "clickRate", asOf }); const rowOpenLevel = normalLevel(rows, row, { metric: "openRate", asOf }); return <tr key={row.id}><td><strong>{row.date} · {row.subject || row.title}</strong></td><td><CompetenceComparison openDelta={rowOpenLevel.delta} clickDelta={clickLevel.delta} /></td><td>{num(row.delivered)}</td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td>{row.openRate > 0 ? pct(row.clickRate / row.openRate * 100) : "—"}</td><td>{onSelect ? <button className="row-link" onClick={() => onSelect(row.id)}>Åbn</button> : null}</td></tr>; })}</tbody></table></div></section>
    <details className="panel overview-method"><summary>Om tallene og datagrundlaget</summary><p>Visningen omfatter kun sendte udsendelser med Ungapped-tagget <strong>{name}</strong>. Nyhedsbrevet segmenteres ikke, og derfor vises ingen målgruppeanalyse.</p><MeasurementGuideContent /></details>
  </div>;
}


function MagazineTopics({ rows, ranking: controlledRanking, topicFilter: controlledTopic, onRankingChange, onTopicChange }: { rows: Mailing[] } & MagazineTopicControls) {
  const [localRanking, setLocalRanking] = useState("clicks");
  const [localTopic, setLocalTopic] = useState("");
  const ranking = controlledRanking ?? localRanking;
  const topicFilter = controlledTopic ?? localTopic;
  const setRanking = onRankingChange || setLocalRanking;
  const setTopicFilter = onTopicChange || setLocalTopic;
  const summary = summarizeMagazineTopics(rows);
  const topics = summary.topics.filter(topic => topic.topic !== magazineReviewTopic).sort((a, b) => ranking === "rate" ? b.clickRate - a.clickRate : b.clicks - a.clicks);
  const review = summary.topics.find(topic => topic.topic === magazineReviewTopic);
  const leader = topics[0];
  const selectedTopic = topicFilter;
  const articles = summary.measured.filter(item => !selectedTopic || item.topic === selectedTopic).sort((a, b) => b.clicks - a.clicks);
  const max = Math.max(1, ...topics.map(topic => ranking === "rate" ? topic.clickRate : topic.clicks));
  return <section className="panel magazine-topics" aria-labelledby="magazine-topic-title">
    <div className="overview-section-header"><div><p className="eyebrow">Magasinet P · Emneanalyse</p><h2 id="magazine-topic-title">Hvilke emner får flest klik?</h2><p>Artikler grupperet efter deres primære emne i den valgte visning.</p></div><fieldset className="period-toggle"><legend>Sammenlign efter</legend><div><button type="button" aria-pressed={ranking === "clicks"} onClick={() => setRanking("clicks")}>Samlede klik</button><button type="button" aria-pressed={ranking === "rate"} onClick={() => setRanking("rate")}>Klikrate pr. artikel</button></div></fieldset></div>
    <p className="magazine-coverage"><strong>{summary.uniqueArticles} forskellige artikler</strong> med målbare linkresultater · {summary.measured.length} forekomster i {summary.coveredMailings} af {rows.length} udsendelser.</p>
    {leader ? <div className="insight neutral"><TrendingUp /><div><strong>{ranking === "rate" ? "Højeste klikrate pr. artikel" : "Flest registrerede klik"}: {leader.topic}</strong><p>{leader.lowerBound ? "Mindst " : ""}{num(leader.clicks)} klik på {leader.uniqueArticles} forskellige artikler i {leader.appearances} forekomster. Klikrate pr. artikel: {leader.lowerBound ? "≥ " : ""}{pct(leader.clickRate)}.{leader.uniqueArticles < 3 ? " Resultatet bygger på færre end tre forskellige artikler og er et spinkelt grundlag." : ""}</p></div></div> : <DataGap title="Ingen målbare emner endnu" text="Der mangler dokumenterede kontaktmål for artiklerne i denne periode." />}
    <div className="table-scroll"><table><thead><tr><th>Emne</th><th>Registrerede klik</th><th>Forskellige artikler</th><th>Forekomster i nyhedsbreve</th><th>Klik pr. forekomst</th><th>Klikrate pr. artikel</th></tr></thead><tbody>{topics.map(topic => <tr key={topic.topic}><td><button className="row-link" onClick={() => setTopicFilter(topic.topic)}>{topic.topic}</button><div className="magazine-topic-bar"><span style={{ width: `${(ranking === "rate" ? topic.clickRate : topic.clicks) / max * 100}%` }} /></div></td><td><b>{topic.lowerBound ? "≥ " : ""}{num(topic.clicks)}</b></td><td>{topic.uniqueArticles}</td><td>{topic.appearances}</td><td>{topic.lowerBound ? "≥ " : ""}{num(Math.round(topic.averageClicks))}</td><td>{topic.lowerBound ? "≥ " : ""}{pct(topic.clickRate)}</td></tr>)}</tbody></table></div>
    {review || summary.unmeasured ? <p className="method-note">{review ? `${review.uniqueArticles} artikler står til emnegennemgang og indgår ikke i emnerangeringen. ` : ""}{summary.unmeasured ? `${summary.unmeasured} artikelresultater mangler et sammenligneligt kontaktmål og indgår ikke.` : ""}</p> : null}
    <details className="magazine-article-details" open={Boolean(selectedTopic) || undefined}><summary>Se artiklerne bag emnerne</summary><label className="issue-filter"><span>Emne</span><select value={selectedTopic} onChange={event => setTopicFilter(event.target.value)}><option value="">Alle emner</option>{selectedTopic && !summary.topics.some(topic => topic.topic === selectedTopic) ? <option value={selectedTopic}>{selectedTopic} · Ingen artikler i denne visning</option> : null}{summary.topics.map(topic => <option key={topic.topic}>{topic.topic}</option>)}</select></label><div className="table-scroll"><table><thead><tr><th>Artikel</th><th>Emneforslag</th><th>Udsendelse</th><th>Registrerede klik</th><th>Klik pr. 100 leverede</th></tr></thead><tbody>{!articles.length ? <EmptyRow columns={5} text="Ingen målbare artikler for dette emne i den valgte visning." /> : null}{articles.map(item => <tr key={`${item.mailingId}-${item.destination}`}><td><ContentCell item={item} /></td><td>{item.topic}</td><td>{item.date}</td><td><LinkClicks item={item} /></td><td>{item.lowerBound ? "≥ " : ""}{pct(item.rate)}</td></tr>)}</tbody></table></div></details>
    <p className="method-note">Emnerne er redaktionelle forslag; hver artikel får ét primært emne. En forekomst er én artikel i én udsendelse. En artikel sendt flere gange tæller som flere forekomster, men kun én forskellig artikel. Klikrate pr. artikel beregnes som summen af artikelklik divideret med summen af leverede mails for de målbare forekomster. Samlede klik er ikke unikke læsere på tværs af artikler eller udsendelser. Klik dokumenterer interesse, ikke læsning. Placering, rubrik og gentagelser kan påvirke resultatet.</p>
    <p className="method-note">Dækningen omfatter kun artikler med gemte, sammenlignelige linkresultater. Den aktuelle import gemmer resultater med mindst fem klik; artikler med få eller ingen klik og udsendelser uden linkdata indgår ikke. Derfor beskriver tallene de målbare artikler og er ikke et gennemsnit af alt udsendt indhold.</p>
  </section>;
}

function UnsegmentedAudienceClicks({ rows, name, singleIssue = false }: { rows: Mailing[]; name: "Kompetencenyt" | "Magasinet P"; singleIssue?: boolean }) {
  const profiles = segments.map((segment) => {
    const measurements = rows.flatMap((mailing) => {
      const data = segmentRows(mailing).find((item) => item.name === segment);
      return data ? [{ mailing, data }] : [];
    });
    const summary = summarizeSegmentRates(measurements.map(item => item.data));
    return { segment, clickRate: summary.click ?? 0, issues: summary.count, method: summary.method };
  }).filter((profile) => profile.issues > 0).sort((a, b) => b.clickRate - a.clickRate);
  const maxRate = Math.max(...profiles.map((profile) => profile.clickRate), 1);
  const overallRate = average(rows.map((row) => row.clickRate));
  const leader = profiles[0];
  return <section className="panel unsegmented-audience-profile" aria-labelledby={`${name.replace(/\W/g, "-")}-audience-title`}>
    <div className="audience-profile-header"><div><p className="eyebrow">Klik efter medlemsgruppe</p><h2 id={`${name.replace(/\W/g, "-")}-audience-title`}>Hvilke medlemsgrupper klikkede?</h2><p>{singleIssue ? "Gruppernes klikrate i den valgte udsendelse." : "Gruppernes gennemsnitlige klikrate i den valgte periode."}</p></div>{leader ? <div className="audience-profile-highlight"><span>Højeste klikrate</span><strong>{leader.segment}</strong><small>{pct(leader.clickRate)} · {num(leader.issues)} udgaver med data</small></div> : null}</div>
    {profiles.length ? <><div className="audience-profile-chart" role="list" aria-label={`Klikrate i ${name} efter medlemsgruppe`}>{profiles.map((profile, index) => <article key={profile.segment} role="listitem" className={index === 0 ? "leading" : ""}>
      <div className="audience-profile-label"><span>{index + 1}</span><div><strong>{profile.segment}</strong><small>{num(profile.issues)} af {num(rows.length)} udgaver · {profile.method === "delivered" ? "vægtet efter leverede" : "uvægtet gennemsnit"}</small></div></div>
      <div className="audience-profile-bar" aria-label={`${profile.segment}: ${pct(profile.clickRate)}`}><span style={{ width: `${Math.max(3, profile.clickRate / maxRate * 100)}%` }} /></div>
      <strong className="audience-profile-rate">{pct(profile.clickRate)}</strong>
    </article>)}</div><div className="audience-profile-benchmark"><span /><p>{singleIssue ? "Nyhedsbrevets klikrate i den valgte udsendelse:" : "Nyhedsbrevets gennemsnitlige klikrate i perioden:"} <strong>{pct(overallRate)}</strong></p></div><p className="method-note">Alle modtog samme nyhedsbrev. Medlemsgrupperne er efterfølgende filtre på Ungappeds aggregerede klikstatistik og kan overlappe. Derfor summerer de ikke til 100 %, og modulet viser ikke unikke personer på tværs af grupper.</p></> : <DataGap title="Målgruppedata er på vej" text="Modulet vises, når Ungapped har leveret filtrerede klikresultater for mindst én medlemsgruppe." />}
  </section>;
}

function PeriodAverageChart({ openRate, clickRate, count, tag = "Kompetencenyt", description, methodNote, period, onPeriodChange }: { openRate: number; clickRate: number; count: number; tag?: string; description?: string; methodNote?: string; period?: string; onPeriodChange?: (period: string) => void }) {
  const metrics = [
    { label: "Gennemsnitlig åbningsrate", value: openRate, className: "open" },
    { label: "Gennemsnitlig klikrate", value: clickRate, className: "click" },
  ];
  return <section className="panel period-average" aria-labelledby="period-average-title">
    <div className="overview-section-header"><div><h2 id="period-average-title">Gennemsnit i den valgte periode</h2><p>{description || `Beregnet på tværs af ${num(count)} udsendelser med tagget ${tag}.`}</p></div>{period && onPeriodChange ? <label className="average-period"><span>Periode</span><select value={period} onChange={(event) => onPeriodChange(event.target.value)}><option>Seneste 12 måneder</option><option>Seneste 6 måneder</option><option>Alle år</option></select></label> : null}</div>
    <div className="period-average-chart">{metrics.map(metric => <article key={metric.label} className={metric.className}>
      <div><span>{metric.label}</span><strong>{pct(metric.value)}</strong></div>
      <div className="average-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }} /></div>
    </article>)}</div>
    <p className="method-note">{methodNote || "Hver udsendelse tæller lige meget i gennemsnittet af registrerede rater. Det er ikke en samlet andel af alle leverede mails."}</p>
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

function Overview({ rows, onOpen, asOf, period, onPeriodChange }: { rows: Mailing[]; onOpen: (id: string) => void; asOf: string; period: string; onPeriodChange: (period: string) => void }) {
  const periodNews = topPeriodNews(rows);
  const latest = rows[0];
  const previous = rows[1];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se Psykologernes Nyhedsbrev." />;
  const averageOpenRate = average(rows.map(row => row.openRate));
  const averageClickRate = average(rows.map(row => row.clickRate));
  const comparison = normalLevel(rows, latest, { metric: "clickRate", asOf });
  const openComparison = normalLevel(rows, latest, { metric: "openRate", asOf });
  const topLinks = latest.content.filter(item => isComparableLink(item) && item.editorial?.kind === "news").sort((a, b) => b.clicks - a.clicks).slice(0, 3);
  const verdict = comparison.delta === null ? "Resultatet kan endnu ikke sammenlignes" : comparison.delta >= 1 ? "Klikraten er højere end det tidligere niveau" : comparison.delta <= -1 ? "Klikraten er lavere end det tidligere niveau" : "Klikraten er på niveau med tidligere udsendelser";
  const verdictNote = comparison.delta === null ? comparisonStatus(comparison).message : `Klikraten var ${formatPoint(Math.abs(comparison.delta))} procentpoint ${comparison.delta >= 0 ? "over" : "under"} niveauet for ${comparison.count} tidligere udsendelser.`;
  return <div className="stack overview-page">
    <div className="period-overview-group">
    <PeriodAverageChart openRate={averageOpenRate} clickRate={averageClickRate} count={rows.length} tag="Psykologernes Nyhedsbrev" period={period} onPeriodChange={onPeriodChange} />
    <section className="overview-section period-news" aria-labelledby="period-news-title">
      <div className="overview-section-header"><h2 id="period-news-title">Mest klikkede nyheder</h2><span className="period-news-scope" aria-live="polite">{period}</span></div>
      <div className="period-news-grid">{periodNews.length ? periodNews.map(({ item, mailing }, index) => <article key={item.destination}>
        <div className="period-news-heading"><span className="overview-rank">{index + 1}</span><TopicBadge item={item} /></div>
        <h3><a href={item.destination} target="_blank" rel="noreferrer">{displayTitle(item)}</a></h3>
        <div className="period-news-result"><strong>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)}</strong><span>kontakter klikkede</span></div>
        <div className="period-news-footer"><time dateTime={mailing.sentAt}>{mailing.date}</time><button className="row-link" onClick={() => onOpen(mailing.id)}>Se udsendelse <ArrowRight /></button></div>
      </article>) : <DataGap title="Ingen dokumenterede nyhedsklik i perioden" text="Vælg en længere periode." />}</div>
    </section>
    </div>
    <section className={`overview-verdict ${comparison.delta === null ? "pending" : comparison.delta <= -1 ? "below" : "above"}`}>
      <div className="overview-verdict-content">
        <p className="eyebrow">Seneste udsendelse · {latest.date}</p>
        <h2>{latest.subject || latest.title}</h2>
        <div className="overview-assessment"><span>Vurdering</span><h3>{verdict}</h3><p>{verdictNote}</p></div>
      </div>
      <strong>{comparison.delta === null ? comparisonStatus(comparison).label : comparison.delta >= 1 ? "↑ Klik højere" : comparison.delta <= -1 ? "↓ Klik lavere" : "→ Klik på niveau"}</strong>
    </section>
    <MeasurementContext mailing={latest} level={comparison} asOf={asOf} /><CoverageSummary rows={rows} />
    <section className="kpi-grid overview-kpis" aria-label="Nøgletal for seneste udsendelse">
      <Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note={previous ? `${signed(latest.delivered - previous.delivered)} sammenlignet med sidst` : "Første udsendelse i perioden"} />
      <Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} count={countLabel(latest.openCount, "åbninger")} note={levelText(openComparison.delta)} />
      <Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} count={countLabel(latest.clickCount, "klik")} note={levelText(comparison.delta)} />
      <Kpi icon={<Users />} label="Afmeldinger" value={num(latest.unsubscribes || 0)} note="Registreret efter udsendelsen" />
    </section>
    <section className="overview-section"><div className="overview-section-header"><div><h2>Hvad interesserede medlemmerne?</h2><p>De mest klikkede nyheder i den seneste udsendelse.</p></div><button className="row-link" onClick={() => onOpen(latest.id)}>Se hele analysen</button></div><div className="overview-stories">{topLinks.length ? topLinks.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{contentTopic(item)}</span></div><div><strong>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)} klik</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede linkresultater" text="Ungapped leverede ikke brugbare klik pr. nyhed for denne udsendelse." />}</div></section>
    <EditorialDecisionSupport rows={rows} selected={latest} asOf={asOf} onOpen={onOpen} />
    <OverviewTrend rows={rows} latest={latest} baseline={comparison.delta === null ? null : comparison.baseline} />
    <section className="panel table-panel overview-recent"><div className="overview-section-header"><div><h2>Seneste udsendelser</h2><p>Et kort overblik over udviklingen.</p></div></div><div className="table-scroll"><table><thead><tr><th>Dato og emnefelt</th><th>Vurdering</th><th>Åbnet</th><th>Klikket</th><th></th></tr></thead><tbody>{rows.slice(0, 5).map((row) => { const level = normalLevel(rows, row, { metric: "clickRate", asOf }); return <tr key={row.id}><td><strong>{row.date} · {row.subject || row.title}</strong></td><td><PerformanceBadge delta={level.delta} /></td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td><button className="row-link" onClick={() => onOpen(row.id)}>Åbn</button></td></tr>; })}</tbody></table></div></section>
    <details className="panel overview-method"><summary>Om tallene og datagrundlaget</summary><MeasurementGuideContent /></details>
    <CategoryInterestChart rows={rows} period={period} onPeriodChange={onPeriodChange} />
  </div>;
}

function CategoryInterestChart({ rows, period, onPeriodChange }: { rows: Mailing[]; period: string; onPeriodChange: (period: string) => void }) {
  const coveredRows = rows
    .map(row => ({ ...row, content: row.content.filter(item => isComparableLink(item) && item.editorial?.kind === "news") }))
    .filter(row => row.content.length);
  const topics = summarizeEditorialTopics(coveredRows).filter(topic => topic.category !== "Andet" && topic.clicks > 0);
  const totalClicks = topics.reduce((sum, topic) => sum + topic.clicks, 0);
  const maxClicks = Math.max(...topics.map(topic => topic.clicks), 1);
  const leader = topics[0];
  const mostEfficient = [...topics].sort((a, b) => b.clicks / Math.max(1, b.links) - a.clicks / Math.max(1, a.links))[0];
  return <section className="panel category-interest" aria-labelledby="category-interest-title">
    <div className="category-interest-header"><div><p className="eyebrow">Indholdsfordeling i den valgte periode</p><h2 id="category-interest-title">Hvilke emner blev der klikket mest på?</h2><p>Sammenlign den samlede klikinteresse med klik pr. nyhed.</p></div><div className="category-interest-actions"><label className="category-period"><span>Periode</span><select value={period} onChange={(event) => onPeriodChange(event.target.value)} aria-label="Periode for indholdsfordeling"><option>Seneste 12 måneder</option><option>Seneste 6 måneder</option><option>Alle år</option></select></label>{leader ? <div className="category-interest-highlight"><span>Flest klik samlet</span><strong>{leader.category}</strong><small>{num(leader.clicks)} registrerede klik</small></div> : null}</div></div>
    {topics.length ? <><div className="category-chart" role="list" aria-label="Registrerede klik fordelt på nyhedskategorier">{topics.map((topic, index) => {
      const share = totalClicks ? topic.clicks / totalClicks * 100 : 0;
      const perStory = topic.clicks / Math.max(1, topic.links);
      return <article key={topic.category} role="listitem" className={index === 0 ? "leading" : ""}>
        <div className="category-chart-label"><span>{index + 1}</span><div><strong>{topic.category}</strong><small>{num(topic.links)} nyhed{topic.links === 1 ? "" : "er"}</small></div></div>
        <div className="category-chart-bar" aria-label={`${topic.category}: ${num(topic.clicks)} klik, ${pct(share)} af de kategoriserede klik`}><span style={{ width: `${Math.max(2, topic.clicks / maxClicks * 100)}%` }} /></div>
        <div className="category-chart-total"><strong>{num(topic.clicks)}</strong><span>klik · {pct(share)}</span></div>
        <div className="category-chart-average"><strong>{num(Math.round(perStory))}</strong><span>klik pr. nyhed</span></div>
      </article>;
    })}</div><div className="category-interest-footer"><p><strong>{num(totalClicks)}</strong> kategoriserede klik fordelt på <strong>{num(topics.reduce((sum, topic) => sum + topic.links, 0))}</strong> nyheder i <strong>{num(coveredRows.length)}</strong> udsendelser.</p>{mostEfficient ? <p>Flest klik pr. nyhed: <strong>{mostEfficient.category}</strong> med {num(Math.round(mostEfficient.clicks / Math.max(1, mostEfficient.links)))}.</p> : null}</div><p className="method-note">Grafen viser registrerede klik på redaktionelle historier – ikke dokumenteret læsning eller unikke personer på tværs af links. Kategorier med flere nyheder får naturligt flere muligheder for klik; derfor vises også klik pr. nyhed.</p></> : <DataGap title="Ingen kategoriserede klik i perioden" text="Modulet vises, når udsendelserne har dokumenterede klik på redaktionelle historier." />}
  </section>;
}

function AudienceView({ rows, comparisonRows, singleIssue, onOpen, asOf, audience: controlledAudience, onAudienceChange }: { audience?: string; onAudienceChange?: (name: string) => void; rows: Mailing[]; comparisonRows: Mailing[]; singleIssue: boolean; onOpen: (id: string) => void; asOf: string }) {
  const [localAudience, setLocalAudience] = useState(segments[0]);
  const audience = controlledAudience ?? localAudience;
  const setAudience = onAudienceChange || setLocalAudience;
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const availableSegments = segments.filter((name) => comparisonRows.some((mailing) => segmentRows(mailing).some((item) => item.name === name)));
  const selectedAudience = audience;
  const series = rows.map((mailing) => ({ mailing, data: segmentRows(mailing).find((item) => item.name === selectedAudience) })).filter((item): item is { mailing: Mailing; data: NonNullable<LiveMailing["segmentPerformance"]>[number] } => Boolean(item.data));
  const rateSummary = summarizeSegmentRates(series.map(item => item.data));
  const averageOpenRate = rateSummary.open ?? 0;
  const averageClickRate = rateSummary.click ?? 0;
  const allLinks = rows.flatMap((mailing) => segmentLinkRows(mailing).filter((item) => item.audience === selectedAudience).map((item) => ({ ...item, mailing })));
  const links = partitionLinkMeasurements(allLinks).contacts;
  const linkCoverage = new Set(links.map((item) => item.mailing.id)).size;
  const latest = series[0];
  const level = latest ? normalLevel(comparisonRows, latest.mailing, { audience: selectedAudience, metric: "clickRate", asOf }) : null;
  const verdict = !level || level.delta === null ? "Resultatet kan endnu ikke sammenlignes" : level.delta >= 1 ? "Målgruppen reagerede over sit normale niveau" : level.delta <= -1 ? "Målgruppen reagerede under sit normale niveau" : "Målgruppen reagerede på sit normale niveau";
  const verdictNote = !level || level.delta === null ? comparisonStatus(level).message : `Klikraten var ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} medianen for ${level.count} tidligere udsendelser.`;
  const visibleHistory = historyExpanded ? series : series.slice(0, 6);
  const visibleLinks = linksExpanded ? links : links.slice(0, 8);
  function selectAudience(name: string) {
    setAudience(name);
    setHistoryExpanded(false);
    setLinksExpanded(false);
  }
  return <div className="stack newsletter-workspace">
    <section className="newsletter-intro"><div><p className="eyebrow">Psykologernes Nyhedsbrev</p><h2>Følg én målgruppe ad gangen</h2><p>{singleIssue ? `Se resultaterne for udsendelsen ${rows[0]?.date || ""}.` : "Se udviklingen, de stærkeste historier og de vigtigste redaktionelle signaler."}</p></div><div className="segment-coverage"><strong>{series.length} udgaver</strong><span>har brugbare data for den valgte målgruppe</span></div></section>
    <section className="panel audience-picker"><div className="audience-tabs" role="tablist" aria-label="Medlemssegmenter">{segments.map((name) => { const available = availableSegments.includes(name); return <button key={name} role="tab" aria-selected={selectedAudience === name} disabled={!available} title={available ? undefined : "Ingen dokumenterede data i den valgte periode"} className={selectedAudience === name ? "audience-tab selected" : "audience-tab"} onClick={() => selectAudience(name)}><span>{name}</span>{!available ? <small>Ingen data</small> : null}</button>; })}</div></section>
    {singleIssue && !series.length ? <DataGap title="Ingen målgruppetal for den valgte udsendelse" text={`Der er ingen offentliggørelsesklare resultater for ${selectedAudience} i denne udsendelse. Vælg en anden målgruppe eller udsendelse.`} /> : null}
    {!singleIssue && series.length ? <PeriodAverageChart openRate={averageOpenRate} clickRate={averageClickRate} count={series.length} tag="Psykologernes Nyhedsbrev" methodNote={rateSummary.method === "delivered" ? "Gennemsnittet er vægtet efter gemte leveringer for målgruppen i hver udsendelse." : "Uvægtet gennemsnit pr. udsendelse: historiske leveringstal mangler for mindst én udgave. Vi gætter ikke på dem."} description={`Beregnet på tværs af ${num(series.length)} udsendelser med brugbare data for ${selectedAudience}.`} /> : null}
    {latest ? <section className={`audience-verdict ${level?.delta == null ? "pending" : level.delta <= -1 ? "below" : "above"}`}><div><p className="eyebrow">{selectedAudience} · {singleIssue ? "valgt udsendelse" : "seneste udsendelse"} {latest.mailing.date}</p><h2>{verdict}</h2><p>{verdictNote}</p></div><strong>{!level || level.delta === null ? comparisonStatus(level).label : level.delta >= 1 ? "↑ Over normalt niveau" : level.delta <= -1 ? "↓ Under normalt niveau" : "→ På normalt niveau"}</strong></section> : null}
    {latest ? <MeasurementContext mailing={latest.mailing} level={level} asOf={asOf} audience={selectedAudience} /> : null}
    <p className="analysis-coverage-note">Målgrupperater: {series.length} af {rows.length} udsendelser. Kontaktrangering: {linkCoverage} af {rows.length}. Manglende linkresultater er ikke nul klik. Medlemsstatus ved afsendelse er ikke dokumenteret.</p>
    <section className="kpi-grid audience-kpis"><Kpi icon={<Mail />} label="Udgaver med data" value={num(series.length)} note={singleIssue ? "Den valgte udsendelse" : `${num(rows.length)} udgaver i perioden`} /><Kpi icon={<Users />} label={singleIssue ? "Modtagerantal" : "Seneste modtagerantal"} value={latest ? latest.data.recipientsLabel : "—"} note={latest?.data.delivered != null ? `${num(latest.data.delivered)} leverede · raternes grundlag` : "Historisk leveringstal ikke gemt"} /><Kpi icon={<Activity />} label="Åbningsrate" value={latest ? pct(latest.data.openRate) : "—"} count={countLabel(latest?.data.openCount, "åbninger")} note={singleIssue ? "Den valgte udsendelse" : "Seneste udsendelse"} /><Kpi icon={<MousePointerClick />} label="Klikrate" value={latest ? pct(latest.data.clickRate) : "—"} count={countLabel(latest?.data.clickCount, "klik")} note={levelText(level?.delta ?? null)} /></section>
    {!singleIssue && latest ? <AudienceTrend series={series} baseline={level?.delta == null ? null : level.baseline} audience={selectedAudience} /> : null}
    <section className="panel table-panel audience-links"><PanelHeader eyebrow={selectedAudience} title="Hvad interesserede målgruppen?" meta={`${linkCoverage} af ${rows.length} udgaver har dokumenterede målgruppekontaktklik`} /><p className="content-scope-note">{singleIssue ? "Historier rangeret efter dokumenterede unikke kontakter i den valgte udsendelse." : "Historier rangeret efter dokumenterede unikke kontakter i den valgte periode."} Visningen dokumenterer ikke, at indholdet kun blev sendt til denne målgruppe.</p><div className="table-scroll"><table><thead><tr><th>Historie eller link</th><th>Emne</th><th>Udsendelse</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{links.length ? visibleLinks.map((item) => <tr key={`${item.mailing.id}-${item.destination}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td>{item.mailing.date}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={5} text={singleIssue ? "Ingen dokumenterede linkresultater for denne målgruppe i den valgte udsendelse." : "Ingen dokumenterede linkresultater for denne målgruppe i den valgte periode."} />}</tbody></table></div>{links.length > 8 ? <ExpandButton expanded={linksExpanded} total={links.length} onClick={() => setLinksExpanded((value) => !value)} /> : null}</section>
    <OtherLinkMeasurements items={allLinks} />
    {latest ? <EditorialDecisionSupport rows={comparisonRows} selected={latest.mailing} audience={selectedAudience} asOf={asOf} onOpen={onOpen} /> : null}
    <details className="panel overview-method"><summary>{singleIssue ? "Se resultater og datagrundlag for den valgte udsendelse" : "Se de enkelte udsendelser og datagrundlaget"}</summary><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th></th></tr></thead><tbody>{series.length ? visibleHistory.map(({ mailing, data }) => <tr key={mailing.id}><td><strong>{mailing.title}</strong></td><td>{mailing.date}</td><td>{data.recipientsLabel}</td><td>{pct(data.openRate)}</td><td><b>{pct(data.clickRate)}</b></td><td>{pct(data.ctor)}</td><td><button className="row-link" onClick={() => onOpen(mailing.id)}>Åbn</button></td></tr>) : <EmptyRow columns={7} text={`Der er endnu ingen offentliggørelsesklare resultater for ${selectedAudience}.`} />}</tbody></table></div>{series.length > 6 ? <ExpandButton expanded={historyExpanded} total={series.length} onClick={() => setHistoryExpanded((value) => !value)} /> : null}<MeasurementGuideContent /></details>
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


function MailingView({ rows, selected, asOf, onOpen }: { rows: Mailing[]; selected?: Mailing; asOf: string; onOpen: (id:string)=>void }) {
  if (!selected) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode." />;
  const content = partitionLinkMeasurements(selected.content).contacts;
  const news = content.filter((item) => item.editorial?.kind === "news");
  const topStories = news.slice(0, 5);
  const performance = [...segmentRows(selected)].sort((a, b) => b.clickRate - a.clickRate);
  const segmentLinks = partitionLinkMeasurements(segmentLinkRows(selected)).contacts;
  const ctor = selected.openRate ? selected.clickRate / selected.openRate * 100 : 0;
  const level = normalLevel(rows, selected, { metric: "clickRate", asOf });
  const verdict = level.delta === null ? "Resultatet kan endnu ikke sammenlignes" : level.delta >= 1 ? "Klikraten er højere end det tidligere niveau" : level.delta <= -1 ? "Klikraten er lavere end det tidligere niveau" : "Klikraten er på niveau med tidligere udsendelser";
  const verdictNote = level.delta === null ? comparisonStatus(level).message : `Klikraten var ${formatPoint(Math.abs(level.delta))} procentpoint ${level.delta >= 1 ? "over" : level.delta <= -1 ? "under" : "fra"} medianen for ${level.count} tidligere udsendelser.`;
  return <div className="stack mailing-page">
    <section className={`mailing-verdict ${level.delta === null ? "pending" : level.delta <= -1 ? "below" : "above"}`}><div><p className="eyebrow">{selected.date} · Psykologernes Nyhedsbrev</p><h2>{verdict}</h2><p>{verdictNote}</p></div><PerformanceBadge delta={level.delta} /></section>
    <MeasurementContext mailing={selected} level={level} asOf={asOf} />
    <section className="panel mailing-summary"><PanelHeader eyebrow="Denne udsendelse" title={selected.title} meta={selected.date} /><p className="subject-line"><span>Emnefelt</span>{selected.subject}</p><div className="kpi-grid compact mailing-kpis"><Kpi icon={<Mail />} label="Leverede" value={num(selected.delivered)} note="Mails registreret som leveret" /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(selected.openRate)} count={countLabel(selected.openCount, "åbninger")} note="Registrerede åbninger" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(selected.clickRate)} count={countLabel(selected.clickCount, "klik")} note={levelText(level.delta)} /><Kpi icon={<TrendingUp />} label="CTOR" value={pct(ctor)} note="Klik blandt registrerede åbninger" /><Kpi icon={<Users />} label="Afmeldinger" value={num(selected.unsubscribes || 0)} note="Registreret efter udsendelsen" /></div></section>
    <MailingTrend rows={rows} selected={selected} baseline={level.delta === null ? null : level.baseline} />
    <section className="overview-section"><div className="overview-section-header"><div><h2>Hvad interesserede medlemmerne?</h2><p>De mest klikkede redaktionelle historier i udsendelsen.</p></div></div><div className="overview-stories mailing-stories">{topStories.length ? topStories.map((item, index) => <article key={`${item.destination}-${index}`}><span className="overview-rank">{index + 1}</span><div><strong>{displayTitle(item)}</strong><span>{contentTopic(item)}</span><AudienceExposure item={item} /></div><div><strong>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)} klik</strong><span>{formatPoint(item.rate)} pr. 100 leverede</span></div></article>) : <DataGap title="Ingen dokumenterede historier" text="Der er ingen brugbare klikresultater for redaktionelle historier i denne udsendelse." />}</div></section>
    <section className="panel table-panel mailing-audiences"><PanelHeader eyebrow="Målgrupper" title="Hvordan reagerede målgrupperne?" meta={performance.length ? `${performance.length} målgrupper med data` : "Ingen målgruppedata"} /><div className="table-scroll"><table><thead><tr><th>Målgruppe</th><th>Emnefelt</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th></tr></thead><tbody>{performance.length ? performance.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{subjectForAudience(selected, item.name) || <span className="muted-cell">Samme eller ikke dokumenteret</span>}</td><td>{item.recipientsLabel}</td><td>{pct(item.openRate)}</td><td><b>{pct(item.clickRate)}</b></td></tr>) : <EmptyRow columns={5} text="Der er ingen brugbare målgrupperesultater for denne udsendelse." />}</tbody></table></div></section>
    <EditorialDecisionSupport rows={rows} selected={selected} asOf={asOf} onOpen={onOpen} />
    <details className="panel overview-method mailing-details"><summary>Se alle linkresultater og datagrundlaget</summary><p className="content-scope-note">Dokumenterede kontaktmål for hele udsendelsen uden målgruppefilter vises først. Andre måletyper står særskilt nedenfor. Målgruppefilteret dokumenterer, hvem der klikkede, men ikke at en historie kun blev sendt til den pågældende målgruppe. Målgrupper kan overlappe.</p><h3>Linkresultater med dokumenterede unikke kontakter</h3><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Emne</th><th>Registrerede linkklik</th><th>Klik pr. 100 leverede</th></tr></thead><tbody>{content.length ? content.map((item, index) => <tr key={`${item.destination}-${index}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={4} text="Ingen dokumenterede linkresultater for denne udsendelse." />}</tbody></table></div><OtherLinkMeasurements items={selected.content} date={selected.date} /><h3>Målgruppefordelte kontaktmål</h3><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Målgruppe</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{segmentLinks.length ? segmentLinks.map((item, index) => <tr key={`${item.destination}-${item.audience}-${index}`}><td><ContentCell item={item} /></td><td>{item.audience}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={4} text="Ingen dokumenterede målgruppefordelte kontaktmål for denne udsendelse." />}</tbody></table></div><OtherLinkMeasurements items={segmentLinkRows(selected)} date={selected.date} /><MeasurementGuideContent /></details>
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

function TopicBadge({ item, category }: { item?: { title?: string; destination: string; editorial?: EditorialMetadata }; category?: string }) { return <span className="topic-badge" title={item?.editorial?.source === "editor" ? "Redaktionelt rettet" : "Automatisk emneforslag"}>{category || contentTopic(item!)}</span>; }

function ExpandButton({ expanded, total, onClick }: { expanded: boolean; total: number; onClick: () => void }) { return <button className="expand-table" type="button" aria-expanded={expanded} onClick={onClick}>{expanded ? <><ChevronUp />Vis færre</> : <><ChevronDown />Vis alle {total}</>}</button>; }

function homeComparisonReason(level: ReturnType<typeof normalLevel> | null) {
  const status = comparisonStatus(level);
  return status.readyAt ? `Vurdering tidligst ${new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeZone: "Europe/Copenhagen" }).format(new Date(status.readyAt))}` : status.status === "insufficient" ? `${level?.count || 0} af mindst 3 tidligere målinger` : "Rate eller størrelsesgrundlag mangler";
}
function countLabel(value: number | undefined, noun: string) { return Number.isFinite(value) ? `${num(value!)} registrerede ${noun}` : "Antal ikke gemt"; }
function measurementDate(value: string | undefined | null) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(new Date(value)) : "tidspunkt ikke gemt"; }
function MeasurementContext({ mailing, level, asOf, audience = "" }: { mailing: Mailing; level: ReturnType<typeof normalLevel> | null; asOf: string; audience?: string }) {
  const status = comparisonStatus(level);
  return <section className="panel measurement-context" aria-label="Måletidspunkt og sammenligningsgrundlag"><div className="measurement-context-heading"><strong>{status.label}</strong><span>Senest registreret: {measurementDate(audience ? mailing.segmentPerformance?.find(row => row.name === audience)?.observedAt : mailing.observedAt)}</span></div><p>{status.message}{status.readyAt ? ` Tidligst ${measurementDate(status.readyAt)}; det kræver også tilstrækkelig historik og en ny dataopdatering.` : ""}</p><details><summary>Se gemte målepunkter efter 1 og 7 dage</summary><p>Disse er særskilte observationer og er ikke grundlaget for den historiske vurdering ovenfor.</p><div className="checkpoint-grid">{[1, 7].map(day => {
    const checkpoint = checkpointStatus(mailing, day, asOf);
    const point = checkpoint.point;
    const data = audience ? point?.segmentPerformance?.find((row: { name: string }) => row.name === audience) : point;
    const label = checkpoint.status === "captured" ? data ? "Gemt måling" : "Målgruppetal ikke gemt" : checkpoint.status === "historical" ? "Før målepunktsarkivet / afsendelsestid ukendt" : checkpoint.status === "waiting" ? "Afventer tidspunktet" : checkpoint.status === "due" ? "Målevindue åbent · endnu ikke gemt" : "Målevindue passeret · ingen måling gemt";
    return <div key={day}><strong>{day} dag{day === 1 ? "" : "e"} · {label}</strong>{data ? <span>Åbnet {pct(data.openRate)} · Klikket {pct(data.clickRate)} · {num(data.delivered)} leverede</span> : null}{point ? <small>Observeret {measurementDate(audience ? point.segmentsObservedAt : point.capturedAt)}</small> : null}</div>;
  })}</div></details></section>;
}
function Kpi({ icon, label, value, note, count }: { icon: ReactNode; label: string; value: string; note: string; count?: string }) { return <article className="kpi"><div className="kpi-icon">{icon}</div><span>{label}</span><strong>{value}</strong>{count ? <small className="kpi-count">{count}</small> : null}<small className="neutral">{note}</small></article>; }
function PerformanceBadge({ delta }: { delta: number | null }) {
  const label = delta === null ? "Kan ikke sammenlignes" : delta >= 1 ? "Over normalt" : delta <= -1 ? "Under normalt" : "På normalt niveau";
  return <span className={`performance-badge ${delta === null ? "unknown" : delta >= 1 ? "positive" : delta <= -1 ? "negative" : "neutral"}`}>{label}</span>;
}
function OverviewTrend({ rows, latest, baseline }: { rows: Mailing[]; latest: Mailing; baseline: number | null }) {
  const chronological = rows.filter(row => sentTime(row) <= sentTime(latest)).slice(0, 6).reverse();
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
  const coverage = summarizeCoverage(rows);
  const values = [["Udsendelsestal", coverage.total], ["Dokumenterede kontaktklik pr. nyhed", coverage.links], ["Målgrupperater", coverage.segments], ["Dokumenterede målgruppekontaktklik", coverage.segmentLinks]] as const;
  return <section className="panel coverage-panel" aria-label="Datadækning"><div><p className="eyebrow">Datadækning i perioden</p><p>{[...new Set(rows.map(row => row.type))].join(" · ")} · Kun udsendelser med det relevante målegrundlag tælles. Linkrangeringer kan dække en del af perioden.</p></div><div className="coverage-grid">{values.map(([label, value]) => <div key={label}><strong>{value} af {rows.length}</strong><span>{label}</span></div>)}</div></section>;
}
function MeasurementGuide() {
  return <details className="panel measurement-guide"><summary>Sådan skal tallene læses · historik og målretning</summary><MeasurementGuideContent /></details>;
}
function MeasurementGuideContent() {
  return <div className="measurement-guide-content">
    <p><strong>Modtagere og leveringer:</strong> Modtagere er udsendelsens målgruppe før fradrag af fejlede leveringer og bounces. Leverede er mails registreret som leveret. Summer på tværs af udgaver er ikke unikke personer.</p>
    <p><strong>Målgruppegennemsnit:</strong> Vi vægter efter leveringer, når alle udgaver i beregningen har gemte leveringstal. Ellers viser vi et uvægtet gennemsnit pr. udgave. Vi gætter ikke på historiske leveringstal.</p>
    <p><strong>Klikmål:</strong> Unikke kontakter og samlede klik vises særskilt ved hvert link. Samme person kan klikke på flere links. Når flere linkplaceringer er samlet, vises det højeste dokumenterede kontaktantal som et minimum. Historiske klikmål uden gemt feltdefinition er mærket; de indgår ikke i automatiske emnekonklusioner.</p>
    <p><strong>Måletidspunkt:</strong> Udsendelser under syv dage mærkes foreløbige. Historiske vurderinger bruger senest registrerede tal, ikke faste syvdagesmålinger. Eventuelle gemte 1- og 7-dagesmålinger vises særskilt; manglende målepunkter genskabes ikke.</p>
    <p><strong>Antal og rater:</strong> Registrerede åbnings- og klikantal kommer direkte fra API’et. Unikke menneskelige læsere er ikke dokumenteret. Manglende antal rekonstrueres ikke fra afrundede procenter. CTOR er klikraten divideret med åbningsraten, ikke dokumenteret læsning.</p>
    <p><strong>Linkdækning:</strong> Importen gemmer linkresultater fra fem klik og opefter. En fraværende artikel betyder derfor ikke nul klik. Historiske måletyper uden gemt definition tælles ikke som dokumenteret kontaktdækning.</p>
    <p><strong>Rater:</strong> Udsendelsens klikrate følger API’ets registrerede klik i forhold til leverede mails. Linktabellerne viser klik pr. 100 leverede eller modtagere — ikke andelen af dem, der fik vist netop den nyhed. Raterne dokumenterer ikke menneskelige læsere eller klik renset for automatiske systemer.</p>
    <p><strong>Målretning:</strong> Målgruppeklik viser, hvem der har registrerede klik i filteret. De dokumenterer ikke, at nyheden kun blev sendt til den målgruppe. Indholdets eksponering er endnu ikke kortlagt, og målgrupper kan overlappe.</p>
    <p><strong>Historik:</strong> Det er endnu ikke bekræftet, om kontaktfiltre bruger medlemsstatus på afsendelsesdatoen eller ved opslaget. Resultaterne skal derfor ikke læses som en dokumenteret historisk medlemsbestand. Data over en måned gamle bevares som historik; seneste opdatering betyder ikke, at alle historiske tal er genberegnet.</p>
    <p><strong>Metode fra 17. september 2026:</strong> Nye importer gemmer målefelt og beregningsgrundlag. Eksisterende historiske tal bevares. <a href="https://github.com/Michellelagergaard/dashboard/blob/main/docs/measurement-methods.md" target="_blank" rel="noreferrer">Se dokumentation og kendte begrænsninger</a>.</p>
  </div>;
}
type OtherLinkItem = { title?: string; destination: string; clicks: number; rate: number; clickMeasurement?: ClickMeasurement; editorial?: EditorialMetadata; audience?: string; mailing?: Mailing };
function OtherLinkMeasurements({ items, date }: { items: OtherLinkItem[]; date?: string }) {
  const { events, historical } = partitionLinkMeasurements(items);
  if (!events.length && !historical.length) return null;
  return <details className="panel other-link-measurements"><summary>Andre klikmål · {num(events.length + historical.length)} resultater uden for kontaktrangeringen</summary><p className="method-note">Disse resultater bevares særskilt. Klikhændelser kan omfatte gentagne klik fra samme person, og historiske mål mangler en gemt feltdefinition. De indgår ikke i rangeringen eller automatiske linkkonklusioner.</p>{[{ title: "Samlede klikhændelser", rows: events }, { title: "Historiske klikmål · måletypen er ikke dokumenteret", rows: historical }].filter(group => group.rows.length).map(group => <section key={group.title}><h3>{group.title}</h3><div className="table-scroll"><table><thead><tr><th>Historie eller link</th><th>Emne</th><th>Udsendelse</th><th>Målgruppe</th><th>Registrerede klik</th><th>Rate for dette mål</th></tr></thead><tbody>{group.rows.map((item, index) => <tr key={`${item.destination}-${item.audience || ""}-${item.mailing?.id || index}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td>{item.mailing?.date || date || "—"}</td><td>{item.audience || "—"}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>)}</tbody></table></div></section>)}</details>;
}
function contentTopic(item: { title?: string; destination: string; editorial?: EditorialMetadata }) {
  return magazineTopicNames.includes(item.editorial?.category) || item.editorial?.category === magazineReviewTopic ? item.editorial!.category : String(editorialCategory(item));
}

function LinkClicks({ item }: { item: { clicks: number; clickMeasurement?: ClickMeasurement } }) {
  return <><b>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)}</b><span>{clickMeasurementLabel(item)}</span></>;
}
function LinkRate({ item }: { item: { rate: number; clickMeasurement?: ClickMeasurement } }) {
  return <>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{pct(item.rate)}{!item.clickMeasurement ? <span>Tidligere beregning</span> : null}</>;
}
function ContentCell({ item }: { item: { title?: string; destination: string; editorial?: EditorialMetadata } }) {
  const source = item.editorial?.source;
  const label = source === "editor" ? "Redaktionelt kontrolleret overskrift" : source === "article-title" ? "Overskrift fra artiklens side" : source === "magazine-reference" ? "Overskrift fra en anden udsendelse" : ["heading", "styled-heading"].includes(source || "") ? "Overskrift fra nyhedsbrevet" : "Linktekst · overskrift ikke sikkert fundet";
  return <><strong><a href={item.destination} target="_blank" rel="noreferrer">{displayTitle(item)}</a></strong><span>{shortLink(item.destination)}</span><span className="title-source">{label}{item.editorial?.ambiguous ? " · Flere titler til samme adresse" : ""}</span></>;
}
function PanelHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) { return <div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>; }
function DataGap({ title, text }: { title: string; text: string }) { return <div className="insight neutral data-gap"><Activity /><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="panel"><DataGap title={title} text={text} /></section>; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td className="empty-cell" colSpan={columns}>{text}</td></tr>; }
function segmentRows(mailing: Mailing) { return mailing.segmentPerformance || []; }
function segmentLinkRows(mailing: Mailing) { return mailing.segmentLinkPerformance || []; }

function subjectForAudience(mailing: Mailing, audience: string) { return mailing.segmentSubjects?.find((item) => item.audience === audience)?.subject; }
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
function inPeriod(mailing: Mailing, period: string, asOf: string) {
  if (period === "Alle år") return true;
  if (!mailing.sentAt) return false;
  const cutoff = new Date(asOf);
  const months = period === "Seneste 6 måneder" ? 6 : 12;
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return new Date(mailing.sentAt) >= cutoff;
}
function signed(value: number) { return `${value >= 0 ? "+" : ""}${num(value)}`; }
function formatPoint(value: number) { return value.toLocaleString("da-DK", { maximumFractionDigits: 1 }); }
function levelText(delta: number | null) { return delta === null ? "Kan endnu ikke sammenlignes" : delta >= 1 ? `${formatPoint(delta)} procentpoint over normalt` : delta <= -1 ? `${formatPoint(Math.abs(delta))} procentpoint under normalt` : "På normalt niveau"; }
function shortLink(destination: string) { try { const url = new URL(destination); return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`; } catch { return destination; } }

