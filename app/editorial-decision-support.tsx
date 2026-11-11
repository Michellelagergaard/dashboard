"use client";

import type { LiveMailing } from "./live-data";
import { editorialTakeaway } from "../config/editorial-takeaway.mjs";

export function EditorialDecisionSupport({rows,selected,asOf,audience="",onOpen}:{rows:LiveMailing[];selected:LiveMailing;asOf:string;audience?:string;onOpen?:(id:string)=>void}) {
  const takeaway = editorialTakeaway(rows,{selected,asOf,audience});
  return <section className="panel editorial-support takeaway-support">
    <div className="panel-header"><div><p className="eyebrow">Redaktionelt takeaway</p><h2>Hvad kan vi lære af udsendelsen?</h2></div><span>{selected.type}{audience ? ` · ${audience}` : ""}</span></div>
    <p className="subject-scope">{selected.date} · {audience ? `Respons fra ${audience}` : "Respons på tværs af modtagerne"} · sammenholdt med den valgte periode</p>
    <div className="takeaway-insight"><span className="decision-kicker">{takeaway.status.status === "preliminary" ? "Foreløbig læsning" : "Hovedindsigt"}</span><h3>{takeaway.headline}</h3><p>{takeaway.interpretation}</p></div>
    <div className="takeaway-columns"><div><h3>Det bygger vurderingen på</h3><p>{takeaway.performance}</p>
      {takeaway.links.length > 0 && <ul className="takeaway-evidence">{takeaway.links.map(item=><li key={item.destination}><a href={item.destination} target="_blank" rel="noreferrer">{item.editorial?.title || item.title || "Link uden dokumenteret titel"}</a><strong>{item.clickMeasurement?.aggregation === "max-per-destination" ? "Mindst " : ""}{item.clicks.toLocaleString("da-DK")} kontakter</strong></li>)}</ul>}
    </div><div className="takeaway-action"><p className="eyebrow">Til næste udsendelse</p><h3>Redaktionel handling</h3><p>{takeaway.action}</p></div></div>
    <details className="decision-examples editorial-method"><summary>Grundlag og forbehold</summary><p>Analysen gælder udsendelsen fra {selected.date}. Historikken omfatter {takeaway.historyCount} udsendelser fra samme nyhedsbrev i den valgte periode frem til denne dato. {takeaway.comparisonCount} tidligere udsendelser har sammenlignelige rater og størrelse; mindst tre kræves.</p><p>{takeaway.linkCount} gemte destinationslinks har dokumenterede kontaktklik over nul{audience ? ` for ${audience}` : ""}. Rangeringen gælder disse links og er ikke nødvendigvis dækkende for alt indhold. Kontaktklik på forskellige links må ikke lægges sammen som unikke læsere. Ved gentagne links kan tallet være en nedre grænse.</p><p>Dette er en regelbaseret fortolkning af registrerede resultater. Klik viser respons, men beviser ikke, at emnet, formuleringen eller placeringen skabte den. Åbninger påvirkes af mailklienters privatlivsbeskyttelse. Historiske målinger kan have forskellig alder; syv dage er en minimumsalder, ikke et fælles måletidspunkt.</p></details>
    {onOpen && <button type="button" className="decision-link" onClick={()=>onOpen(selected.id)}>Se udsendelsens detaljer →</button>}
  </section>;
}
