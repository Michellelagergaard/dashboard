"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, ChevronDown, ChevronRight, ChevronUp, Code2, Mail, MousePointerClick, Send, Users } from "lucide-react";
import { DecisionWorkbench } from "./decision-workbench";
import type { ClickMeasurement, EditorialMetadata, LiveDashboardData, LiveMailing } from "./live-data";
import { EditorialProvider, ContentEditor } from "./editorial-editor";
import { contentKinds, enrichMailings } from "../config/editorial-content.mjs";
import { memberSegmentNames, minimumPublicSegmentSize } from "../config/member-segments.mjs";
import { editorialCategory, summarizeEditorialTopics } from "../config/editorial-topics.mjs";
import { summarizeSegmentRates, clickMeasurementLabel, isComparableLink } from "../config/measurement-methods.mjs";

const memberSegmentFieldLabel = "Sektioner, medlemskab og egne felter";
type View = "overview" | "audiences" | "mailing";
type Mailing = LiveMailing;

const segments = memberSegmentNames;
const pct = (value: number) => `${value.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %`;
const num = (value: number) => value.toLocaleString("da-DK");

export function Dashboard({ liveData }: { liveData: LiveDashboardData }) {
  return <EditorialProvider>{corrections => <DashboardContent liveData={{ ...liveData, mailings: enrichMailings(liveData.mailings, corrections) }} />}</EditorialProvider>;
}

function DashboardContent({ liveData }: { liveData: LiveDashboardData }) {
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState("Seneste 12 måneder");
  const [contentKind, setContentKind] = useState("news");
  const mailings = useMemo(
    () => [...liveData.mailings].filter((mailing) => inPeriod(mailing, period)).sort((a, b) => sentTime(b) - sentTime(a)),
    [liveData.mailings, period],
  );
  const [selectedId, setSelectedId] = useState("");
  const selected = mailings.find((mailing) => mailing.id === selectedId) || mailings[0];
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
      <div className="brand"><div className="brand-mark" aria-hidden="true">dp</div><div><strong>Dansk Psykolog<br />Forening</strong><span>Psykologernes Nyhedsbrev</span></div></div>
      <nav aria-label="Primær navigation">
        <p className="nav-kicker">Redaktionelt dashboard</p>
        <Nav active={view === "overview"} onClick={() => setView("overview")} icon={<Send />} label="Overblik" />
        <Nav active={view === "audiences"} onClick={() => setView("audiences")} icon={<Users />} label="Målgrupper" />
        <Nav active={view === "mailing"} onClick={() => setView("mailing")} icon={<Mail />} label="Udsendelse" />
      </nav>
      <div className="sidebar-footer"><div className="sidebar-note"><span className="status-dot" />{liveData.status === "live" ? "Opdateres fra Ungapped" : "Seneste tilgængelige data"}</div><a className="repo-link" href="https://github.com/Michellelagergaard/dashboard" target="_blank" rel="noreferrer"><Code2 />GitHub-repository</a></div>
    </aside>
    <main id="main" className="main">
      <header className="topbar"><div><p className="eyebrow">Analyse af medlemskommunikation</p><h1>{view === "overview" ? "Overblik" : view === "audiences" ? "Målgrupper" : "Udsendelse"}</h1></div><div className="sync-box"><div><span>Senest opdateret</span><strong>{updated}</strong></div></div></header>
      <section className="filters simple-filters" aria-label="Filtre"><div className="filter-main"><label><span>Periode</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Seneste 12 måneder</option><option>Seneste 6 måneder</option><option>Alle år</option></select></label></div><p className="filter-result"><strong>{num(mailings.length)}</strong> udsendelser med tagget Psykologernes Nyhedsbrev</p></section>
      <MeasurementGuide />
      {view !== "overview" ? <section className="panel content-filter"><label>Vis indhold<select value={contentKind} onChange={event => setContentKind(event.target.value)}>{Object.entries(contentKinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}<option value="all">Alt indhold</option></select></label><p>Filteret gælder linktabellerne. Servicelinks og indhold til gennemgang er bevaret. Automatiske emner er forslag, som I kan rette ved hver historie.</p></section> : null}
      {liveData.status === "unavailable" ? <Empty title="Data er ikke tilgængelige" text="Den seneste dataopdatering kunne ikke læses. Prøv igen senere." /> : null}
      {liveData.status !== "unavailable" && view === "overview" ? <Overview rows={mailings} onOpen={openMailing} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && view === "audiences" ? <AudienceView rows={mailings} onOpen={openMailing} contentKind={contentKind} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
      {liveData.status !== "unavailable" && view === "mailing" ? <MailingView rows={mailings} selected={selected} onChange={setSelectedId} contentKind={contentKind} asOf={liveData.updatedAt || new Date().toISOString()} /> : null}
    </main>
  </div>;
}

function Nav({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>{icon}<span>{label}</span><ChevronRight /></button>;
}

function Overview({ rows, onOpen, asOf }: { rows: Mailing[]; onOpen: (id: string) => void; asOf: string }) {
  const latest = rows[0];
  const previous = rows[1];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se Psykologernes Nyhedsbrev." />;
  const ctor = latest.openRate ? latest.clickRate / latest.openRate * 100 : 0;
  const topLinks = latest.content.filter(item => item.editorial?.kind === "news").sort((a, b) => b.clicks - a.clicks).slice(0, 6);
  return <div className="stack">
    <CoverageSummary rows={rows} />
    <section className="panel latest-hero"><PanelHeader eyebrow="Seneste udsendelse" title={latest.title} meta={latest.date} /><p className="subject-line"><span>Emnefelt</span>{latest.subject}</p><div className="kpi-grid compact"><Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note={previous ? `${signed(latest.delivered - previous.delivered)} mod forrige` : "Første udsendelse i perioden"} /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} note="Registreret i Ungapped" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} note="Normalniveau vises nedenfor" /><Kpi icon={<Users />} label="CTOR" value={pct(ctor)} note="Klikrate delt med åbningsrate" /></div><button className="primary-action" onClick={() => onOpen(latest.id)}>Se hele udsendelsen <ChevronRight /></button></section>
    <DecisionWorkbench rows={rows} selected={latest} asOf={asOf} onOpen={onOpen} />
    <details className="panel"><summary>Uddybning: emner i hele perioden</summary><EditorialIntelligence rows={rows} /></details>
    <section className="panel table-panel"><PanelHeader eyebrow="Seneste udsendelse" title="Mest klikkede nyheder" meta="Registrerede linkklik · mindst 5" /><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Registrerede linkklik</th><th>Klik pr. 100 leverede</th></tr></thead><tbody>{topLinks.length ? topLinks.map((item) => <tr key={item.destination}><td><ContentCell item={item} /></td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={3} text="Ungapped leverede ikke brugbare klik pr. link for denne udsendelse." />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Seneste udsendelser" title="Hvad skal redaktionen følge?" meta="Klik er prioriteret" /><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Leverede</th><th>Åbnet</th><th>Klikket</th><th></th></tr></thead><tbody>{rows.slice(0, 8).map((row) => <tr key={row.id}><td><strong>{row.title}</strong><span>{row.subject}</span></td><td>{row.date}</td><td>{num(row.delivered)}</td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td><button className="row-link" onClick={() => onOpen(row.id)}>Åbn</button></td></tr>)}</tbody></table></div></section>
  </div>;
}

function AudienceView({ rows, onOpen, contentKind, asOf }: { rows: Mailing[]; onOpen: (id: string) => void; contentKind: string; asOf: string }) {
  const [audience, setAudience] = useState(segments[0]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [linksExpanded, setLinksExpanded] = useState(false);
  const availableSegments = segments.filter((name) => rows.some((mailing) => segmentRows(mailing).some((item) => item.name === name)));
  const selectedAudience = availableSegments.includes(audience) ? audience : availableSegments[0] || audience;
  const series = rows.map((mailing) => ({ mailing, data: segmentRows(mailing).find((item) => item.name === selectedAudience) })).filter((item): item is { mailing: Mailing; data: NonNullable<LiveMailing["segmentPerformance"]>[number] } => Boolean(item.data));
  const recipients = series.reduce((sum, item) => sum + parseNumber(item.data.recipientsLabel), 0);
  const aggregate = summarizeSegmentRates(series.map(item => item.data));
  const open = aggregate.open;
  const click = aggregate.click;
  const aggregateNote = aggregate.method === "delivered" ? "Vægtet efter dokumenterede leveringer" : "Uvæg­tet gennemsnit pr. udgave";
  const links = rows.flatMap((mailing) => segmentLinkRows(mailing).filter((item) => item.audience === selectedAudience && matchesContent(item, contentKind)).map((item) => ({ ...item, mailing }))).sort((a, b) => b.clicks - a.clicks);
  const linkCoverage = new Set(links.map((item) => item.mailing.id)).size;
  const latest = series[0];
  const visibleHistory = historyExpanded ? series : series.slice(0, 6);
  const visibleLinks = linksExpanded ? links : links.slice(0, 8);
  function selectAudience(name: string) {
    setAudience(name);
    setHistoryExpanded(false);
    setLinksExpanded(false);
  }
  return <div className="stack newsletter-workspace">
    <section className="newsletter-intro"><div><p className="eyebrow">Psykologernes Nyhedsbrev</p><h2>Følg én målgruppe ad gangen</h2><p>Resultater fra Ungapped med målgruppefilter. Målgrupper kan overlappe.</p></div><div className="segment-coverage"><strong>{series.length} udgaver</strong><span>har brugbare data for den valgte målgruppe</span></div></section>
    <section className="panel audience-picker"><PanelHeader eyebrow="Vælg målgruppe" title="Hvem vil du følge?" meta="Aggregerede medlemsdata" /><div className="audience-tabs" role="tablist" aria-label="Medlemssegmenter">{segments.map((name) => { const available = availableSegments.includes(name); return <button key={name} role="tab" aria-selected={selectedAudience === name} disabled={!available} title={available ? undefined : "Ingen dokumenterede data i den valgte periode"} className={selectedAudience === name ? "audience-tab selected" : "audience-tab"} onClick={() => selectAudience(name)}><span>{name}</span>{!available ? <small>Ingen data</small> : null}</button>; })}</div></section>
    <section className="kpi-grid audience-kpis"><Kpi icon={<Mail />} label="Udgaver med data" value={num(series.length)} note={`${num(rows.length)} udgaver valgt`} /><Kpi icon={<Users />} label="Modtagere summeret" value={num(recipients)} note="Ikke unikke personer" /><Kpi icon={<Activity />} label="Åbningsrate" value={open !== null ? pct(open) : "—"} note={aggregateNote} /><Kpi icon={<MousePointerClick />} label="Klikrate" value={click !== null ? pct(click) : "—"} note={aggregateNote} /></section>
    {latest ? <DecisionWorkbench rows={rows} selected={latest.mailing} audience={selectedAudience} asOf={asOf} onOpen={onOpen} /> : null}
    <section className="panel table-panel audience-history-table"><PanelHeader eyebrow={selectedAudience} title="Seneste resultater" meta={`${visibleHistory.length} af ${series.length} udgaver vist`} /><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th></th></tr></thead><tbody>{series.length ? visibleHistory.map(({ mailing, data }) => <tr key={mailing.id}><td><strong>{mailing.title}</strong></td><td>{mailing.date}</td><td>{data.recipientsLabel}</td><td>{pct(data.openRate)}</td><td><b>{pct(data.clickRate)}</b></td><td>{pct(data.ctor)}</td><td><button className="row-link" onClick={() => onOpen(mailing.id)}>Åbn</button></td></tr>) : <EmptyRow columns={7} text={`Der er endnu ingen offentliggørelsesklare resultater for ${selectedAudience}.`} />}</tbody></table></div>{series.length > 6 ? <ExpandButton expanded={historyExpanded} total={series.length} onClick={() => setHistoryExpanded((value) => !value)} /> : null}</section>
    <section className="panel table-panel"><PanelHeader eyebrow="Målgruppefordelt indholdsresultat" title={`Hvad klikkede ${selectedAudience} på?`} meta={`${linkCoverage} af ${series.length} udgaver har målgruppefordelte linkklik`} /><p className="content-scope-note">Visningen dokumenterer målgruppens klik. Den dokumenterer ikke, at indholdet udelukkende blev sendt til denne målgruppe.</p><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Emne</th><th>Udsendelse</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{links.length ? visibleLinks.map((item) => <tr key={`${item.mailing.id}-${item.destination}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td>{item.mailing.date}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={5} text="Ingen linkresultater for denne målgruppe og indholdstype. Prøv Alt indhold eller en længere periode." />}</tbody></table></div>{links.length > 8 ? <ExpandButton expanded={linksExpanded} total={links.length} onClick={() => setLinksExpanded((value) => !value)} /> : null}</section>
  </div>;
}

function MailingView({ rows, selected, onChange, contentKind, asOf }: { rows: Mailing[]; selected?: Mailing; onChange: (id: string) => void; contentKind: string; asOf: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!selected) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode." />;
  const content = selected.content.filter(item => matchesContent(item, contentKind)).sort((a, b) => b.clicks - a.clicks);
  const performance = segmentRows(selected);
  const segmentLinks = segmentLinkRows(selected).filter(item => matchesContent(item, contentKind)).sort((a, b) => b.clicks - a.clicks);
  const ctor = selected.openRate ? selected.clickRate / selected.openRate * 100 : 0;
  return <div className="stack">
    <Selection selected={selected} rows={rows} onChange={id => { setExpanded(false); onChange(id); }} />
    <DecisionWorkbench rows={rows} selected={selected} asOf={asOf} onOpen={onChange} />
    <ContentCoverage mailing={selected} />
    <section className="panel"><PanelHeader eyebrow="Denne udsendelse" title={selected.title} meta={selected.date} /><p className="subject-line"><span>Standardemnefelt</span>{selected.subject}</p><div className="kpi-grid compact"><Kpi icon={<Mail />} label="Leverede" value={num(selected.delivered)} note="" /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(selected.openRate)} note="Registrerede åbninger" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(selected.clickRate)} note="API’ets klikrate pr. leveret mail" /><Kpi icon={<Users />} label="CTOR" value={pct(ctor)} note="Klikrate delt med åbningsrate" /></div></section>
    {Math.max(content.length, segmentLinks.length) > 8 ? <ExpandButton expanded={expanded} total={Math.max(content.length, segmentLinks.length)} onClick={() => setExpanded(!expanded)} /> : null}
    <section className="content-scope-grid"><article><span>Samlet resultat</span><strong>{content.length ? `${content.length} linkresultater` : "Ingen linkdata"}</strong><p>Samlede klik i hele udsendelsen uden målgruppefilter.</p></article><article><span>Målgruppefordelt resultat</span><strong>{segmentLinks.length ? `${segmentLinks.length} linkresultater` : "Ingen målgruppedata"}</strong><p>Registrerede linkklik med målgruppefilter. Grupper kan overlappe.</p></article></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Samlet resultat for udsendelsen" title="Hvad blev der klikket på i hele udsendelsen?" meta={coverageFor(selected).linkPerformance ? "Klikmål angives ved hver række" : "Linkdata ikke tilgængelige"} /><p className="content-scope-note">Tallene omfatter hele udsendelsen og kan derfor ikke tilskrives en bestemt målgruppe.</p><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Emne</th><th>Registrerede linkklik</th><th>Klik pr. 100 leverede</th></tr></thead><tbody>{content.length ? (expanded ? content : content.slice(0, 8)).map((item, index) => <tr key={`${item.destination}-${index}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={4} text="Ingen linkresultater for den valgte indholdstype. Prøv Alt indhold." />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Målgrupper" title="Hvordan reagerede målgrupperne?" meta={`${memberSegmentFieldLabel} · grupper under ${minimumPublicSegmentSize} skjules`} /><div className="table-scroll"><table><thead><tr><th>Målgruppe</th><th>Dokumenteret emnefelt</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th>Afmeldinger</th></tr></thead><tbody>{performance.length ? performance.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{subjectForAudience(selected, item.name) || <span className="muted-cell">Ikke koblet til målgruppen i denne datakørsel</span>}</td><td>{item.recipientsLabel}</td><td>{pct(item.openRate)}</td><td><b>{pct(item.clickRate)}</b></td><td>{pct(item.ctor)}</td><td>{item.unsubscribes === null ? "—" : num(item.unsubscribes)}</td></tr>) : <EmptyRow columns={7} text="API'et har ikke leveret verificerbare målgrupperesultater for denne udsendelse." />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Målgruppefordelt indholdsresultat" title="Hvad klikkede målgrupperne på?" meta={coverageFor(selected).segmentLinkPerformance ? "Klikmål angives ved hver række" : "Målgruppefordelte linkklik ikke tilgængelige"} /><p className="content-scope-note">Et målgruppefilter dokumenterer, hvem der klikkede—ikke nødvendigvis at linket var eksklusivt for målgruppen.</p><div className="table-scroll"><table><thead><tr><th>Nyhed eller link</th><th>Emne</th><th>Målgruppe</th><th>Registrerede linkklik</th><th>Klik pr. 100 modtagere</th></tr></thead><tbody>{segmentLinks.length ? (expanded ? segmentLinks : segmentLinks.slice(0, 8)).map((item, index) => <tr key={`${item.destination}-${item.audience}-${index}`}><td><ContentCell item={item} /></td><td><TopicBadge item={item} /></td><td>{item.audience}</td><td><LinkClicks item={item} /></td><td><LinkRate item={item} /></td></tr>) : <EmptyRow columns={5} text="Ingen målgruppefordelte linkresultater for den valgte indholdstype. Prøv Alt indhold." />}</tbody></table></div></section>
  </div>;
}

function Selection({ selected, rows, onChange }: { selected: Mailing; rows: Mailing[]; onChange: (id: string) => void }) {
  return <section className="panel selection-panel"><label><span>Vælg udsendelse</span><select value={selected.id} onChange={(event) => onChange(event.target.value)}>{rows.map((mailing) => <option key={mailing.id} value={mailing.id}>{mailing.date} · {mailing.title}</option>)}</select></label><div><strong>Psykologernes Nyhedsbrev</strong><span>{num(selected.delivered)} leverede · {pct(selected.clickRate)} klikrate</span></div></section>;
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
  return <section className="panel editorial-intelligence"><PanelHeader eyebrow="Redaktionel intelligens" title="Hvad viser de dokumenterede klik?" meta={`${coveredRows.length} af ${rows.length} udgaver har dokumenteret kontaktmål`} />{leading && latestLeading ? <><div className="editorial-conclusions"><article><span>Seneste udgave med linkdata</span><strong>{latestLeading.category}</strong><p>fik flest registrerede linkklik blandt de navngivne emner: {num(latestLeading.clicks)} klik fordelt på {num(latestLeading.links)} link{latestLeading.links === 1 ? "" : "s"}.</p></article><article><span>Hele den valgte periode</span><strong>{leading.category}</strong><p>har flest registrerede linkklik blandt de navngivne emner: {num(leading.clicks)} klik i {num(leading.mailings)} udgave{leading.mailings === 1 ? "" : "r"} med tilgængelige linkdata.</p></article></div><div className="topic-summary" role="list" aria-label="Redaktionelle emnekategorier">{displayTopics.slice(0, 7).map((topic) => <div key={topic.category} role="listitem"><TopicBadge category={topic.category} /><strong>{num(topic.clicks)} klik</strong><span>{num(topic.links)} links · {num(topic.mailings)} udgaver</span></div>)}</div><p className="method-note">Konklusionerne bruger kun nyheder og fagligt indhold med dokumenteret kontaktmål. Servicelinks og indhold til gennemgang er udeladt. Emner er automatiske forslag, medmindre de er rettet redaktionelt. Historiske klikmål uden gemt feltdefinition indgår ikke. Summer er ikke unikke personer på tværs af links; gentagne linkplaceringer kan være angivet som et minimum. Konklusionerne beskriver registreret klikvolumen. De dokumenterer ikke, hvorfor medlemmerne klikkede, og kategorier med flere links får flere muligheder for klik. {other ? `${num(other.links)} af ${num(totalLinks)} linkresultater kunne ikke kategoriseres sikkert og står som Andet.` : "Alle viste linkresultater kunne placeres i en navngiven kategori."}</p></> : <DataGap title="Ingen dokumenterede konklusioner endnu" text="Redaktionelle konklusioner vises, når mindst én udgave i perioden har brugbare linkklik." />}</section>;
}

function TopicBadge({ item, category }: { item?: { title?: string; destination: string; editorial?: EditorialMetadata }; category?: string }) { return <span className="topic-badge" title={item?.editorial?.source === "editor" ? "Redaktionelt rettet" : "Automatisk emneforslag"}>{category || String(editorialCategory(item!))}</span>; }

function ExpandButton({ expanded, total, onClick }: { expanded: boolean; total: number; onClick: () => void }) { return <button className="expand-table" type="button" aria-expanded={expanded} onClick={onClick}>{expanded ? <><ChevronUp />Vis færre</> : <><ChevronDown />Vis alle {total}</>}</button>; }

function Kpi({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="kpi"><div className="kpi-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small className="neutral">{note}</small></article>; }
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
  return <details className="panel measurement-guide"><summary>Sådan skal tallene læses · historik og målretning</summary><div>
    <p><strong>Modtagere og leveringer:</strong> Modtagere er udsendelsens målgruppe før fradrag af fejlede leveringer og bounces. Leverede er mails registreret som leveret. Summer på tværs af udgaver er ikke unikke personer.</p>
    <p><strong>Målgruppegennemsnit:</strong> Vi vægter efter leveringer, når alle udgaver i beregningen har gemte leveringstal. Ellers viser vi et uvægtet gennemsnit pr. udgave. Vi gætter ikke på historiske leveringstal.</p>
    <p><strong>Klikmål:</strong> Unikke kontakter og samlede klik vises særskilt ved hvert link. Samme person kan klikke på flere links. Når flere linkplaceringer er samlet, vises det højeste dokumenterede kontaktantal som et minimum. Historiske klikmål uden gemt feltdefinition er mærket; de indgår ikke i automatiske emnekonklusioner.</p>
    <p><strong>Rater:</strong> Udsendelsens klikrate følger API’ets registrerede klik i forhold til leverede mails. Linktabellerne viser klik pr. 100 leverede eller modtagere — ikke andelen af dem, der fik vist netop den nyhed. Raterne dokumenterer ikke menneskelige læsere eller klik renset for automatiske systemer.</p>
    <p><strong>Målretning:</strong> Målgruppeklik viser, hvem der har registrerede klik i filteret. De dokumenterer ikke, at nyheden kun blev sendt til den målgruppe. Indholdets eksponering er endnu ikke kortlagt, og målgrupper kan overlappe.</p>
    <p><strong>Historik:</strong> Det er endnu ikke bekræftet, om kontaktfiltre bruger medlemsstatus på afsendelsesdatoen eller ved opslaget. Resultaterne skal derfor ikke læses som en dokumenteret historisk medlemsbestand. Data over en måned gamle bevares som historik; seneste opdatering betyder ikke, at alle historiske tal er genberegnet.</p>
    <p><strong>Metode fra 17. september 2026:</strong> Nye importer gemmer målefelt og beregningsgrundlag. Eksisterende historiske tal bevares. <a href="https://github.com/Michellelagergaard/dashboard/blob/main/docs/measurement-methods.md" target="_blank" rel="noreferrer">Se dokumentation og kendte begrænsninger</a>.</p>
  </div></details>;
}
function LinkClicks({ item }: { item: { clicks: number; clickMeasurement?: ClickMeasurement } }) {
  return <><b>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{num(item.clicks)}</b><span>{clickMeasurementLabel(item)}</span></>;
}
function LinkRate({ item }: { item: { rate: number; clickMeasurement?: ClickMeasurement } }) {
  return <>{item.clickMeasurement?.aggregation === "max-per-destination" ? "≥ " : ""}{pct(item.rate)}{!item.clickMeasurement ? <span>Tidligere beregning</span> : null}</>;
}
function ContentCell({ item }: { item: { title?: string; destination: string; editorial?: EditorialMetadata } }) { return <><strong><a href={item.destination} target="_blank" rel="noreferrer">{displayTitle(item)}</a></strong><span>{shortLink(item.destination)}</span><span className="title-source">{item.editorial?.source === "editor" ? "Redaktionelt rettet" : ["heading", "styled-heading"].includes(item.editorial?.source || "") ? "Overskrift fra nyhedsbrevet · automatisk emneforslag" : "Linktekst · overskrift ikke sikkert fundet"}{item.editorial?.ambiguous ? " · Flere titler til samme adresse" : ""}</span><ContentEditor destination={item.destination} editorial={item.editorial} /></>; }
function PanelHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) { return <div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>; }
function DataGap({ title, text }: { title: string; text: string }) { return <div className="insight neutral data-gap"><Activity /><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="panel"><DataGap title={title} text={text} /></section>; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td className="empty-cell" colSpan={columns}>{text}</td></tr>; }
function segmentRows(mailing: Mailing) { return mailing.segmentPerformance || []; }
function segmentLinkRows(mailing: Mailing) { return mailing.segmentLinkPerformance || []; }
function subjectForAudience(mailing: Mailing, audience: string) { return mailing.segmentSubjects?.find((item) => item.audience === audience)?.subject; }
function coverageFor(mailing: Mailing) { return mailing.dataCoverage || { linkPerformance: mailing.content.length > 0, segmentPerformance: segmentRows(mailing).length > 0, segmentSubjects: Boolean(mailing.segmentSubjects?.length), segmentLinkPerformance: segmentLinkRows(mailing).length > 0 }; }
function displayTitle(item: { title?: string; destination: string; editorial?: EditorialMetadata }) { const title = item.editorial?.title || item.title; return title && title !== item.destination && !/^https?:\/\//i.test(title) ? title : shortLink(item.destination); }
function matchesContent(item: { editorial?: EditorialMetadata }, kind: string) { return kind === "all" || (item.editorial?.kind || "unknown") === kind; }
function ContentCoverage({ mailing }: { mailing: Mailing }) { return <section className="panel content-coverage"><p><strong>Indholdet i denne udsendelse</strong> · Vælg indholdstype ovenfor for at se resultaterne.</p><div>{Object.entries(contentKinds).map(([kind,label]) => <span key={kind}><b>{mailing.content.filter(item => matchesContent(item, kind)).length}</b> {label}</span>)}</div><p>“Til gennemgang” betyder, at typen er usikker. Ingen linkresultater er slettet.</p></section>; }
function sentTime(mailing: Mailing) { return mailing.sentAt ? new Date(mailing.sentAt).getTime() : 0; }
function parseNumber(value: string) { return Number(value.replaceAll(".", "").replaceAll(",", ".")) || 0; }
function inPeriod(mailing: Mailing, period: string) { if (period === "Alle år" || !mailing.sentAt) return true; const cutoff = new Date(); cutoff.setUTCMonth(cutoff.getUTCMonth() - (period.includes("6") ? 6 : 12)); return new Date(mailing.sentAt) >= cutoff; }
function signed(value: number) { return `${value >= 0 ? "+" : ""}${num(value)}`; }
function shortLink(destination: string) { try { const url = new URL(destination); return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`; } catch { return destination; } }
