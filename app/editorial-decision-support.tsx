"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import type { LiveMailing } from "./live-data";
import { subjectDecisionEvidence } from "../config/subject-decisions.mjs";
import { memberSegmentNames } from "../config/member-segments.mjs";

type Reference = ReturnType<typeof subjectDecisionEvidence>["references"][number];
type Draft = { mainStory: string; memberValue: string; subject: string; referenceId: string };
const emptyDraft: Draft = { mainStory: "", memberValue: "", subject: "", referenceId: "" };
const draftEvent = "dp-next-issue-draft-change";
const percent = (value: number | null) => value === null ? "Mangler" : `${value.toLocaleString("da-DK",{maximumFractionDigits:1})} %`;
const difference = (value: number | null) => value === null ? "Ikke sammenlignelig endnu" : `${Math.abs(value).toLocaleString("da-DK",{maximumFractionDigits:1})} procentpoint ${value >= 0 ? "over" : "under"} eget normale niveau`;

function ReferenceCard({reference,onOpen}:{reference:Reference;onOpen?:(id:string)=>void}) {
  return <article className="subject-reference">
    <p className="decision-kicker">Faktisk udsendt emnefelt · {reference.mailing.type} · {reference.mailing.date}</p>
    <h3>{reference.subject}</h3>
    <div className="subject-reference-metrics">
      <div><span>Udsendelsens klikrate</span><strong>{percent(reference.click.current.value)}</strong><small>{!reference.click.mature ? "Foreløbig · under syv dage" : difference(reference.click.delta)}</small></div>
      <div><span>Udsendelsens åbningsrate</span><strong>{percent(reference.open.current.value)}</strong><small>{!reference.open.mature ? "Foreløbig · under syv dage" : difference(reference.open.delta)}</small></div>
    </div>
    <div className="subject-story-source"><h4>Historier nævnt i emnefeltet</h4>
      {reference.stories.length ? <ul className="editorial-story-list">{reference.stories.map(story=><li key={story.destination}><a href={story.destination} target="_blank" rel="noreferrer">{story.title}<ArrowRight aria-hidden="true"/></a><small>{story.kind} · {story.clicks === null ? "Præcist kontaktmål mangler for denne afgrænsning" : `${story.clicks.toLocaleString("da-DK")} kontakter klikkede på linket`}</small></li>)}</ul> : <p>Historien bag emnefeltet er ikke entydigt identificeret i de gemte overskrifter.</p>}
    </div>
    {onOpen && <button type="button" className="decision-link" onClick={()=>onOpen(reference.mailing.id)}>Se udsendelsen <ArrowRight aria-hidden="true"/></button>}
  </article>;
}

function subscribeDraft(callback:()=>void) {
  window.addEventListener("storage",callback);window.addEventListener(draftEvent,callback);
  return ()=>{window.removeEventListener("storage",callback);window.removeEventListener(draftEvent,callback);};
}

function NextIssueDraft({newsletter,audience,referenceId}:{newsletter:string;audience:string;referenceId:string}) {
  const [message,setMessage] = useState("");
  const key = `dp-next-issue-draft-v1:${JSON.stringify([newsletter,audience])}`;
  const snapshot = useSyncExternalStore(subscribeDraft,()=>{try{return localStorage.getItem(key)||"";}catch{return "unavailable";}},()=>null);
  let initial = emptyDraft, error = "";
  if(snapshot === "unavailable") error = "Browserens lagring er ikke tilgængelig. Du kan skrive en kladde, men den kan ikke gemmes her.";
  else if(snapshot) {
    try {
      const value = JSON.parse(snapshot);
      if(!value || ["mainStory","memberValue","subject","referenceId"].some(field=>typeof value[field] !== "string")) throw Error();
      initial = value;
    } catch {error = "Den gemte kladde kunne ikke læses. Den bliver ikke overskrevet.";}
  }
  return <div><DraftForm key={`${key}:${snapshot}`} initial={initial} error={error} ready={snapshot !== null} onEdit={()=>setMessage("")} onSave={draft=>{
    try{localStorage.setItem(key,JSON.stringify({...draft,referenceId}));window.dispatchEvent(new Event(draftEvent));setMessage("Kladden er gemt i denne browser.");}catch{setMessage("Kladden kunne ikke gemmes. Bevar teksten i felterne, og kopiér den før du forlader siden.");}
  }}/>{message && <p role="status">{message}</p>}</div>;
}

function DraftForm({initial,error,ready,onSave,onEdit}:{initial:Draft;error:string;ready:boolean;onSave:(draft:Draft)=>void;onEdit:()=>void}) {
  const [draft,setDraft] = useState(initial);
  const edit = (field:keyof Draft,value:string)=>{setDraft(previous=>({...previous,[field]:value}));onEdit();};
  return <form className="next-issue-draft" onSubmit={event=>{
    event.preventDefault();
    onSave(draft);
  }}>
    <h3>Arbejd med næste udsendelse</h3>
    <label>Hovedhistorie til næste udsendelse<input value={draft.mainStory} onChange={event=>edit("mainStory",event.target.value)} maxLength={250} placeholder="Hvilken aktuel historie overvejer du at fremhæve?"/></label>
    <label>Vigtigste pointe for målgruppen<textarea value={draft.memberValue} onChange={event=>edit("memberValue",event.target.value)} maxLength={800} rows={3} placeholder="Hvad skal modtageren vide, forstå eller kunne gøre?"/></label>
    <label>Udkast til emnefelt<input value={draft.subject} onChange={event=>edit("subject",event.target.value)} maxLength={200} placeholder="Skriv den konkrete pointe, du vil fremhæve"/></label>
    {draft.subject && <div className="subject-draft-preview"><span>Dit emnefelt · {draft.subject.length} tegn</span><p>{draft.subject}</p></div>}
    <button type="submit" disabled={!ready || Boolean(error)}>Gem kladde i denne browser</button>
    <p className="method-note">Kladden er kun din arbejdsnote til dette nyhedsbrev og denne målgruppe. Den ændrer ingen historiske data og sender ingen mail.</p>
    {error && <p role="alert">{error}</p>}
  </form>;
}

export function EditorialDecisionSupport({rows,selected,asOf,audience="",onOpen}:{rows:LiveMailing[];selected:LiveMailing;asOf:string;audience?:string;onOpen?:(id:string)=>void}) {
  const [chosenAudience,setChosenAudience] = useState("");
  const [referenceId,setReferenceId] = useState("");
  const [query,setQuery] = useState("");
  const effectiveAudience = audience || chosenAudience;
  const evidence = subjectDecisionEvidence(rows,{selected,asOf,audience:effectiveAudience});
  const terms = query.trim().toLocaleLowerCase("da-DK").split(/\s+/).filter(Boolean);
  const references = evidence.references.filter(row=>terms.every(term=>row.subject.toLocaleLowerCase("da-DK").includes(term)));
  const reference = references.find(row=>row.mailing.id === referenceId) || references.find(row=>row.click.mature) || references[0];
  const needsAudience = selected.type === "Psykologernes Nyhedsbrev" || rows.some(row=>row.type === selected.type && row.segmentSubjects?.length);
  return <section className="panel editorial-support subject-support">
    <div className="panel-header"><div><p className="eyebrow">Til næste udsendelse</p><h2>Vælg hovedhistorie og skriv emnefelt</h2></div><span>{selected.type}{effectiveAudience ? ` · ${effectiveAudience}` : ""}</span></div>
    {!audience && needsAudience && <label className="subject-audience">Hvilken målgruppe skriver du til?<select value={chosenAudience} onChange={event=>{setChosenAudience(event.target.value);setReferenceId("");}}><option value="">Vælg målgruppe</option>{memberSegmentNames.map(name=><option key={name}>{name}</option>)}</select></label>}
    {evidence.audienceRequired ? <p className="editorial-empty">Vælg målgruppe for at se dens faktiske emnefelter og resultater. Forskellige målgruppevarianter bliver ikke blandet sammen.</p> : <>
      <p className="subject-scope">Referencer fra {selected.type}{effectiveAudience ? ` til ${effectiveAudience}` : ""} · i den valgte periode frem til {selected.date}</p>
      <div className="subject-workspace"><div>
        <h3>Find en relevant tidligere udsendelse</h3>
        {evidence.references.length > 0 && <label className="subject-reference-picker">Søg i emnefelterne<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setReferenceId("");}} placeholder="Fx løn, autorisation eller udbud"/></label>}
        {reference ? <><label className="subject-reference-picker">Tidligere emnefelter<select value={reference.mailing.id} onChange={event=>setReferenceId(event.target.value)}>{references.map(row=><option key={row.mailing.id} value={row.mailing.id}>{row.mailing.date} · {row.subject}{!row.click.mature ? " · foreløbig" : ""}</option>)}</select></label><ReferenceCard reference={reference} onOpen={onOpen}/></> : <p className="editorial-empty">{evidence.references.length ? "Ingen tidligere emnefelter matcher søgningen. Prøv et andet ord." : "Der er ingen dokumenterede emnefelter for denne afgrænsning. Du kan stadig arbejde med næste udsendelses kladde."}</p>}
      </div><NextIssueDraft key={`${selected.type}:${effectiveAudience}`} newsletter={selected.type} audience={effectiveAudience} referenceId={reference?.mailing.id || ""}/></div>
      <details className="decision-examples editorial-method"><summary>Se afgrænsning og grundlag</summary>
        <p>{evidence.references.length} af {evidence.total} udsendelser har et brugbart emnefelt for dette valg. {evidence.missingSubjects} mangler eller har en uafklaret variant.</p>
        <p>Alle referencer tilhører samme nyhedsbrev og målgruppe. En manglende målgruppevariant erstattes aldrig med en anden målgruppes emnefelt. Senere udsendelser indgår ikke.</p>
        <p>En historie vises kun, hvis hele dens overskrift matcher emnefeltet eller en hel del adskilt med | eller •. Tvetydige matches udelades. Match dokumenterer, at historien er nævnt i emnefeltet, ikke at den var placeret øverst i mailen. En topscorer bruges aldrig som erstatning.</p>
        <p>Raterne gælder udsendelsen eller den valgte målgruppe. Eget normale niveau er medianen for op til fem tidligere udsendelser med tilsvarende størrelse; mindst tre kræves. Udsendelser under syv dage er foreløbige. De gemte historiske målinger kan have forskellig alder. Hverken åbninger eller klik dokumenterer, at en bestemt formulering skabte resultatet.</p>
      </details>
    </>}
  </section>;
}
