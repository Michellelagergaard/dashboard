"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import sharedFile from "../config/editorial-notes.json";
import { mergeNotes, noteKey, validateNotes } from "../config/editorial-notes.mjs";
const key="dp-editorial-notes-v1", eventName="dp-notes-change";
type Note={mailingId:string;audience:string;observation:string;decision:string;status:string;followUp:string;updatedAt:string};
const shared=validateNotes(sharedFile);
function subscribe(callback:()=>void){window.addEventListener("storage",callback);window.addEventListener(eventName,callback);return()=>{window.removeEventListener("storage",callback);window.removeEventListener(eventName,callback);};}
function snapshot(){try{return localStorage.getItem(key)||"";}catch{return "unavailable";}}
export function EditorialNotes({mailingId,audience="",title}:{mailingId:string;audience?:string;title:string}){
  const stored=useSyncExternalStore(subscribe,snapshot,()=>null);
  const [message,setMessage]=useState("");
  const {file,error}=useMemo(()=>{try{return {file:mergeNotes(shared,stored?validateNotes(JSON.parse(stored)):{version:1,notes:[]}),error:""};}catch{return {file:shared,error:"Gemte noter kunne ikke læses. De er ikke overskrevet."};}},[stored]);
  const note=file.notes.find((row:Note)=>noteKey(row)===noteKey({mailingId,audience})) as Note | undefined;
  function persist(next:ReturnType<typeof validateNotes>){try{localStorage.setItem(key,JSON.stringify(validateNotes(next)));window.dispatchEvent(new Event(eventName));setMessage("Gemt i denne browser. Noter ændrer ikke målingerne.");}catch{setMessage("Noten kunne ikke gemmes i browseren. Prøv at eksportere den eksisterende notefil.");}}
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)+"\n"],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="editorial-notes.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <details className="panel meeting-notes"><summary>Redaktionens noter og næste skridt{note?.decision ? ` · ${note.status==="done"?"Fulgt op":"Til opfølgning"}`:""}</summary><p>{title} · {audience||"Hele udsendelsen"}</p><p>Jeres vurderinger og beslutninger holdes adskilt fra dashboardets dokumenterede observationer.</p>{error?<p role="alert">{error}</p>:null}
    <form key={`${mailingId}-${audience}-${note?.updatedAt||"new"}`} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);persist(mergeNotes(file,{version:1,notes:[{mailingId,audience,observation:String(data.get("observation")),decision:String(data.get("decision")),status:String(data.get("status")),followUp:String(data.get("followUp")),updatedAt:new Date().toISOString()}]}));}}>
      <label>Redaktionens vurdering<textarea aria-label="Redaktionens vurdering" name="observation" maxLength={2000} rows={3} defaultValue={note?.observation||""} placeholder="Hvad tror vi kan forklare resultatet?" /></label>
      <label>Beslutning / næste afprøvning<textarea aria-label="Beslutning / næste afprøvning" name="decision" maxLength={2000} rows={3} defaultValue={note?.decision||""} placeholder="Hvad vil vi gøre i næste nyhedsbrev?" /></label>
      <div className="meeting-note-options"><label>Følg op<input name="followUp" type="date" defaultValue={note?.followUp||""}/></label><label>Status<select name="status" defaultValue={note?.status||"open"}><option value="open">Til opfølgning</option><option value="done">Fulgt op</option></select></label></div>
      <button type="submit" disabled={stored===null||Boolean(error)}>Gem note i denne browser</button>
    </form>{message?<p role="status">{message}</p>:null}
    <details><summary>Del noter med kolleger</summary><p>Noter gemmes lokalt. Eksportér og importér filen mellem kolleger. Ved import bevares den nyeste note for hver udsendelse og målgruppe.</p><div className="editorial-actions"><button type="button" onClick={download}>Eksportér noter</button><label>Importér noter<input type="file" accept=".json,application/json" onChange={async event=>{const input=event.currentTarget,f=input.files?.[0];input.value="";if(!f)return;try{if(f.size>2_000_000)throw Error("Notefilen er for stor.");persist(mergeNotes(file,validateNotes(JSON.parse(await f.text()))));}catch(e){setMessage(e instanceof Error?e.message:"Filen kunne ikke læses.");}}}/></label></div><p>Til fælles brug: Gem den eksporterede fil som <a href="https://github.com/Michellelagergaard/dashboard/edit/main/config/editorial-notes.json" target="_blank" rel="noreferrer">fælles noter i GitHub</a>. Det kræver skriveadgang og gør noterne synlige på dashboardet. Afstem ændringer med kolleger først.</p></details>
  </details>;
}
