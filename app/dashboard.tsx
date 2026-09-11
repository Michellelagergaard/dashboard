"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Activity, ChevronRight, Code2, Mail, MousePointerClick, Send, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LiveDashboardData, LiveMailing } from "./live-data";
import { memberSegmentFieldLabel, memberSegmentNames, minimumPublicSegmentSize } from "../config/member-segments.mjs";

type View = "overview" | "audiences" | "mailing";
type Mailing = LiveMailing;

const segments = memberSegmentNames;
const pct = (value: number) => `${value.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %`;
const num = (value: number) => value.toLocaleString("da-DK");

export function Dashboard({ liveData }: { liveData: LiveDashboardData }) {
  const [view, setView] = useState<View>("overview");
  const [period, setPeriod] = useState("Seneste 12 måneder");
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
      {liveData.status === "unavailable" ? <Empty title="Data er ikke tilgængelige" text="Den seneste dataopdatering kunne ikke læses. Prøv igen senere." /> : null}
      {liveData.status !== "unavailable" && view === "overview" ? <Overview rows={mailings} onOpen={openMailing} /> : null}
      {liveData.status !== "unavailable" && view === "audiences" ? <AudienceView rows={mailings} onOpen={openMailing} /> : null}
      {liveData.status !== "unavailable" && view === "mailing" ? <MailingView rows={mailings} selected={selected} onChange={setSelectedId} /> : null}
    </main>
  </div>;
}

function Nav({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>{icon}<span>{label}</span><ChevronRight /></button>;
}

function Overview({ rows, onOpen }: { rows: Mailing[]; onOpen: (id: string) => void }) {
  const latest = rows[0];
  const previous = rows[1];
  if (!latest) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode for at se Psykologernes Nyhedsbrev." />;
  const ctor = latest.openRate ? latest.clickRate / latest.openRate * 100 : 0;
  return <div className="stack">
    <section className="panel latest-hero"><PanelHeader eyebrow="Seneste udsendelse" title={latest.title} meta={latest.date} /><p className="subject-line">{latest.subject}</p><div className="kpi-grid compact"><Kpi icon={<Mail />} label="Leverede" value={num(latest.delivered)} note={previous ? `${num(latest.delivered - previous.delivered)} mod forrige` : "Første udsendelse i perioden"} /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(latest.openRate)} note={previous ? diff(latest.openRate, previous.openRate) : ""} /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(latest.clickRate)} note={previous ? diff(latest.clickRate, previous.clickRate) : ""} /><Kpi icon={<Users />} label="CTOR" value={pct(ctor)} note="Klik blandt registrerede åbninger" /></div><button className="primary-action" onClick={() => onOpen(latest.id)}>Se udsendelsen <ChevronRight /></button></section>
    <section className="panel trend-panel"><PanelHeader eyebrow="Udvikling" title="Klik og åbninger over tid" meta="Vægtet efter leverede mails" /><Trend rows={rows} /></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Seneste udsendelser" title="Hvad skal redaktionen følge?" meta="Klik er prioriteret" /><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Leverede</th><th>Åbnet</th><th>Klikket</th><th></th></tr></thead><tbody>{rows.slice(0, 8).map((row) => <tr key={row.id}><td><strong>{row.title}</strong><span>{row.subject}</span></td><td>{row.date}</td><td>{num(row.delivered)}</td><td>{pct(row.openRate)}</td><td><b>{pct(row.clickRate)}</b></td><td><button className="row-link" onClick={() => onOpen(row.id)}>Åbn</button></td></tr>)}</tbody></table></div></section>
  </div>;
}

function AudienceView({ rows, onOpen }: { rows: Mailing[]; onOpen: (id: string) => void }) {
  const [audience, setAudience] = useState(segments[0]);
  const series = rows.map((mailing) => ({ mailing, data: segmentRows(mailing).find((item) => item.name === audience) })).filter((item): item is { mailing: Mailing; data: NonNullable<LiveMailing["segmentPerformance"]>[number] } => Boolean(item.data));
  const recipients = series.reduce((sum, item) => sum + parseNumber(item.data.recipientsLabel), 0);
  const open = weightedSegment(series, "openRate", recipients);
  const click = weightedSegment(series, "clickRate", recipients);
  const links = rows.flatMap((mailing) => segmentLinkRows(mailing).filter((item) => item.audience === audience).map((item) => ({ ...item, mailing }))).sort((a, b) => b.clicks - a.clicks);
  return <div className="stack newsletter-workspace">
    <section className="newsletter-intro"><div><p className="eyebrow">Psykologernes Nyhedsbrev</p><h2>Følg én målgruppe ad gangen</h2><p>Se udvikling, udsendelser og de links, som målgruppen faktisk har reageret på.</p></div><div className="segment-coverage"><strong>{series.length} af {rows.length}</strong><span>udgaver har segmentresultater</span></div></section>
    <section className="panel audience-picker"><PanelHeader eyebrow="Vælg målgruppe" title="Hvem vil du følge?" meta="Aggregerede medlemsdata" /><div className="audience-tabs" role="tablist" aria-label="Medlemssegmenter">{segments.map((name) => <button key={name} role="tab" aria-selected={audience === name} className={audience === name ? "audience-tab selected" : "audience-tab"} onClick={() => setAudience(name)}>{name}</button>)}</div></section>
    <section className="kpi-grid audience-kpis"><Kpi icon={<Mail />} label="Udgaver med data" value={num(series.length)} note={`${num(rows.length)} i perioden`} /><Kpi icon={<Users />} label="Modtagere" value={num(recipients)} note="Samlet segmentgrundlag" /><Kpi icon={<Activity />} label="Åbningsrate" value={series.length ? pct(open) : "—"} note="Vægtet over tid" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={series.length ? pct(click) : "—"} note="Vægtet over tid" /></section>
    <section className="panel table-panel"><PanelHeader eyebrow={audience} title="Udvikling fra udsendelse til udsendelse" meta="Sammenlign samme målgruppe" /><div className="table-scroll"><table><thead><tr><th>Udsendelse</th><th>Dato</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th></th></tr></thead><tbody>{series.length ? series.map(({ mailing, data }) => <tr key={mailing.id}><td><strong>{mailing.title}</strong></td><td>{mailing.date}</td><td>{data.recipientsLabel}</td><td>{pct(data.openRate)}</td><td><b>{pct(data.clickRate)}</b></td><td>{pct(data.ctor)}</td><td><button className="row-link" onClick={() => onOpen(mailing.id)}>Åbn</button></td></tr>) : <EmptyRow columns={7} text={`Der er endnu ingen offentliggørelsesklare resultater for ${audience}.`} />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Indholdsperformance" title={`Hvad klikkede ${audience} på?`} meta="Kun dokumenterede segmentklik" /><div className="table-scroll"><table><thead><tr><th>Link eller nyhed</th><th>Udsendelse</th><th>Unikke klik</th><th>Klikandel</th></tr></thead><tbody>{links.length ? links.slice(0, 20).map((item) => <tr key={`${item.mailing.id}-${item.destination}`}><td><strong>{shortLink(item.destination)}</strong><span>{item.destination}</span></td><td>{item.mailing.date}</td><td><b>{num(item.clicks)}</b></td><td>{pct(item.rate)}</td></tr>) : <EmptyRow columns={4} text="Der er endnu ingen segmentfordelte linkklik i denne periode." />}</tbody></table></div></section>
  </div>;
}

function MailingView({ rows, selected, onChange }: { rows: Mailing[]; selected?: Mailing; onChange: (id: string) => void }) {
  if (!selected) return <Empty title="Ingen udsendelser i perioden" text="Vælg en længere periode." />;
  const content = [...selected.content].sort((a, b) => b.clicks - a.clicks);
  const performance = segmentRows(selected);
  const segmentLinks = [...segmentLinkRows(selected)].sort((a, b) => b.clicks - a.clicks);
  const ctor = selected.openRate ? selected.clickRate / selected.openRate * 100 : 0;
  return <div className="stack">
    <Selection selected={selected} rows={rows} onChange={onChange} />
    <section className="panel"><PanelHeader eyebrow="Denne udsendelse" title={selected.title} meta={selected.date} /><p className="subject-line">{selected.subject}</p><div className="kpi-grid compact"><Kpi icon={<Mail />} label="Leverede" value={num(selected.delivered)} note="" /><Kpi icon={<Activity />} label="Åbningsrate" value={pct(selected.openRate)} note="" /><Kpi icon={<MousePointerClick />} label="Klikrate" value={pct(selected.clickRate)} note="" /><Kpi icon={<Users />} label="CTOR" value={pct(ctor)} note="" /></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Indhold" title="Hvad blev der klikket på?" meta="Unikke klik" /><div className="table-scroll"><table><thead><tr><th>Link eller nyhed</th><th>Unikke klik</th><th>Klikandel</th></tr></thead><tbody>{content.length ? content.map((item) => <tr key={item.destination}><td><strong>{shortLink(item.destination)}</strong><span>{item.destination}</span></td><td><b>{num(item.clicks)}</b></td><td>{pct(item.rate)}</td></tr>) : <EmptyRow columns={3} text="Der er ingen offentliggørelsesklare klik pr. link for denne udsendelse." />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Målgrupper" title="Hvordan reagerede målgrupperne?" meta={`${memberSegmentFieldLabel} · grupper under ${minimumPublicSegmentSize} skjules`} /><div className="table-scroll"><table><thead><tr><th>Segment</th><th>Emnelinje til målgruppen</th><th>Modtagere</th><th>Åbnet</th><th>Klikket</th><th>CTOR</th><th>Afmeldinger</th></tr></thead><tbody>{performance.length ? performance.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{subjectForAudience(selected, item.name) || <span className="muted-cell">Fælles emnelinje</span>}</td><td>{item.recipientsLabel}</td><td>{pct(item.openRate)}</td><td><b>{pct(item.clickRate)}</b></td><td>{pct(item.ctor)}</td><td>{item.unsubscribes === null ? "—" : num(item.unsubscribes)}</td></tr>) : <EmptyRow columns={7} text="Segmentresultater er ikke klar for denne udsendelse." />}</tbody></table></div></section>
    <section className="panel table-panel"><PanelHeader eyebrow="Målgruppe × indhold" title="Hvad reagerede målgrupperne på?" meta="Unikke klik i segmentet" /><div className="table-scroll"><table><thead><tr><th>Link eller nyhed</th><th>Målgruppe</th><th>Unikke klik</th><th>Klikandel</th></tr></thead><tbody>{segmentLinks.length ? segmentLinks.map((item) => <tr key={`${item.destination}-${item.audience}`}><td><strong>{shortLink(item.destination)}</strong><span>{item.destination}</span></td><td>{item.audience}</td><td><b>{num(item.clicks)}</b></td><td>{pct(item.rate)}</td></tr>) : <EmptyRow columns={4} text="Der er ingen offentliggørelsesklare segmentfordelte linkklik for denne udsendelse." />}</tbody></table></div></section>
  </div>;
}

function Selection({ selected, rows, onChange }: { selected: Mailing; rows: Mailing[]; onChange: (id: string) => void }) {
  return <section className="panel selection-panel"><label><span>Vælg udsendelse</span><select value={selected.id} onChange={(event) => onChange(event.target.value)}>{rows.map((mailing) => <option key={mailing.id} value={mailing.id}>{mailing.date} · {mailing.title}</option>)}</select></label><div><strong>Psykologernes Nyhedsbrev</strong><span>{num(selected.delivered)} leverede · {pct(selected.clickRate)} klikrate</span></div></section>;
}

function Trend({ rows }: { rows: Mailing[] }) {
  const data = buildTrend(rows);
  if (data.length < 2) return <DataGap title="For lidt historik" text="Udviklingskurven vises, når der er mindst to udsendelser i perioden." />;
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="#dce5e8" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${value} %`} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => pct(Number(value))} /><Legend /><Line name="Åbningsrate" type="monotone" dataKey="open" stroke="#2b718f" strokeWidth={3} dot={{ r: 3 }} /><Line name="Klikrate" type="monotone" dataKey="click" stroke="#c05a45" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>;
}

function Kpi({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) { return <article className="kpi"><div className="kpi-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small className="neutral">{note}</small></article>; }
function PanelHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) { return <div className="panel-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><span>{meta}</span></div>; }
function DataGap({ title, text }: { title: string; text: string }) { return <div className="insight neutral data-gap"><Activity /><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <section className="panel"><DataGap title={title} text={text} /></section>; }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td className="empty-cell" colSpan={columns}>{text}</td></tr>; }
function segmentRows(mailing: Mailing) { return mailing.segmentPerformance || []; }
function segmentLinkRows(mailing: Mailing) { return mailing.segmentLinkPerformance || []; }\nfunction subjectForAudience(mailing: Mailing, audience: string) { return mailing.segmentSubjects?.find((item) => item.audience === audience)?.subject; }
function sentTime(mailing: Mailing) { return mailing.sentAt ? new Date(mailing.sentAt).getTime() : 0; }
function parseNumber(value: string) { return Number(value.replaceAll(".", "").replaceAll(",", ".")) || 0; }
function weightedSegment(rows: Array<{ data: NonNullable<LiveMailing["segmentPerformance"]>[number] }>, field: "openRate" | "clickRate", recipients: number) { return recipients ? rows.reduce((sum, item) => sum + parseNumber(item.data.recipientsLabel) * item.data[field], 0) / recipients : 0; }
function inPeriod(mailing: Mailing, period: string) { if (period === "Alle år" || !mailing.sentAt) return true; const cutoff = new Date(); cutoff.setUTCMonth(cutoff.getUTCMonth() - (period.includes("6") ? 6 : 12)); return new Date(mailing.sentAt) >= cutoff; }
function buildTrend(rows: Mailing[]) { return [...rows].sort((a, b) => sentTime(a) - sentTime(b)).map((row) => ({ label: new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" }).format(new Date(row.sentAt || 0)), open: row.openRate, click: row.clickRate })); }
function diff(current: number, previous: number) { const value = current - previous; return `${value >= 0 ? "+" : ""}${value.toLocaleString("da-DK", { maximumFractionDigits: 1 })} pct.point mod forrige`; }
function shortLink(destination: string) { try { const url = new URL(destination); return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`; } catch { return destination; } }
