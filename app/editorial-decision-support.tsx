import { ArrowRight } from "lucide-react";
import type { LiveMailing } from "./live-data";
import { editorialComparisonPolicy, editorialDecisionEvidence } from "../config/editorial-decisions.mjs";

type Evidence = ReturnType<typeof editorialDecisionEvidence>;
type Story = NonNullable<Evidence["signal"]>["stories"][number];
const num = (value: number) => value.toLocaleString("da-DK");

const emptyMessages = {
  missing: ["Linkdata mangler til en redaktionel vurdering", "Der er ingen brugbare, kategoriserede historier med dokumenterede kontaktklik i den valgte udsendelse."],
  preliminary: ["Udsendelsen er stadig for ny", "Vi venter, til udsendelsen er mindst syv dage gammel, før vi sammenligner indholdet med tidligere udsendelser. En tidlig topscorer er ikke nok til at anbefale næste emne."],
  limited: ["For få sammenlignelige historier", "Der skal være mindst fire historier med præcise kontaktmål fordelt på mindst to emner i udsendelsen. Ellers kan vi ikke vurdere, om et emne skiller sig ud i klikfeltet."],
  history: ["Historikken er endnu for tynd", "Ingen af emnerne har et tilstrækkeligt sammenligningsgrundlag: mindst tre tidligere udsendelser med samme målemetode og mindst tre forskellige historier om emnet."],
  sparse: ["Klikgrundlaget er endnu for lille", "Ingen af de sammenlignelige historier har mindst 25 registrerede kontakter. Vi fremhæver derfor ingen indholdsafvigelse på dette grundlag."],
  stable: ["Ingen tydelig afvigelse at handle på", "De emner, vi kan sammenligne, viser ikke en tilstrækkelig forskel fra tidligere udsendelser. Et kerneemne, der ofte ligger højt, udløser ikke i sig selv et råd om mere af det samme."],
};

function StoryLinks({ stories, onOpen }: { stories: Story[]; onOpen?: (id: string) => void }) {
  return <ul className="editorial-story-list">{stories.map(story => <li key={story.mailing.id + story.item.destination}>
    <a href={story.item.destination} target="_blank" rel="noreferrer">{story.item.editorial?.title || story.item.title}<ArrowRight aria-hidden="true" /></a>
    <small>{story.mailing.date} · nr. {story.rank} af {story.fieldSize} sammenlignelige historier · {num(story.item.clicks)} kontakter</small>
    {onOpen && <button type="button" className="decision-link" onClick={() => onOpen(story.mailing.id)}>Se udsendelsen <ArrowRight aria-hidden="true" /></button>}
  </li>)}</ul>;
}

export function EditorialSignalCard({ evidence, scope, onOpen }: { evidence: Evidence; scope: string; onOpen?: (id: string) => void }) {
  const signal = evidence.signal;
  if (!signal) {
    const [title, explanation] = emptyMessages[evidence.status as keyof typeof emptyMessages];
    return <div className="editorial-empty"><p className="decision-kicker">{scope}</p><h3>{title}</h3><p>{explanation}</p></div>;
  }
  return <div className="editorial-finding">
    <p className="decision-kicker">Et emne at undersøge · {scope}</p>
    <h3>{signal.topic} ligger {signal.delta > 0 ? "højere" : "lavere"} i klikfeltet end tidligere</h3>
    <p className="editorial-finding-intro">Emnets historier ligger samlet {signal.delta > 0 ? "højere" : "lavere"} blandt udsendelsens øvrige historier end i hver af de {signal.count} tidligere udsendelser, vi sammenligner med.</p>
    <div className="decision-cards editorial-comparison">
      <article className="decision-card"><h4>Denne udsendelse</h4><StoryLinks stories={signal.stories} onOpen={onOpen} /></article>
      <article className="decision-card"><h4>Samme emne i forrige sammenligningsudsendelse</h4><StoryLinks stories={signal.history[0].stories} onOpen={onOpen} /><details className="decision-examples"><summary>Se de {signal.count - 1} øvrige sammenligningsudsendelser</summary>{signal.history.slice(1).map(previous => <StoryLinks key={previous.mailing.id} stories={previous.stories} onOpen={onOpen} />)}</details></article>
    </div>
    <div className="editorial-question"><strong>Til redaktionsmødet</strong><p>Hvad adskiller {signal.stories.length === 1 ? "den aktuelle historie" : "de aktuelle historier"} fra de tidligere historier om {signal.topic.toLocaleLowerCase("da-DK")}? Sammenlign aktualitet, vinkel og placering, før I beslutter, hvad I vil gentage eller ændre.</p><small>Tallene peger på en forskel at undersøge. De viser ikke, hvad der har skabt den.</small></div>
  </div>;
}

function ComparisonBasis({ evidence }: { evidence: Evidence }) {
  return <details className="decision-examples editorial-method"><summary>Se grundlag og begrænsninger</summary>
    <p>{evidence.covered} af {evidence.total} udsendelser i den valgte periode har brugbare, kategoriserede kontaktklik. {evidence.matureCovered} er mindst syv dage gamle. Den valgte udsendelse har {evidence.storyCount} historier med præcise kontaktmål.</p>
    <p>Vi sammenligner samme emne inden for samme nyhedsbrev og den valgte målgruppe. Højst {editorialComparisonPolicy.maxHistory} tidligere udsendelser med samme målemetode indgår. Senere udsendelser bruges aldrig.</p>
    <p>Historierne ordnes efter kontaktklik inden for hver udsendelse. Placeringen omregnes til en skala fra 0 (bund) til 100 (top); delte placeringer får samme værdi. Medianen for emnets historier beregnes først pr. udsendelse og derefter på tværs af tidligere udsendelser. Hver udsendelse vægter lige meget, og emner med mange historier får ikke automatisk en højere værdi.</p>
    <p>En forskel fremhæves først, når den er mindst {editorialComparisonPolicy.minShift} point på placeringsskalaen og ligger uden for alle de tidligere udsendelsers værdier. Mindst én af udsendelsens historier skal have {editorialComparisonPolicy.minContacts} kontaktklik. Grænserne er redaktionelle screeningsregler, ikke statistisk sikkerhed eller dokumentation for effekt.</p>
    <p>Nul klik indgår. Ukendte emner og klikmål, servicelinks samt minimumstal fra gentagne linkplaceringer udelades. Placering i mailen, eksponering, forskellig målealder og automatiserede klik kan påvirke resultatet. En registreret kontakt dokumenterer ikke læsning eller medlemsværdi.</p>
    {evidence.comparisons.length > 0 && <div className="table-scroll"><table><caption>Emner med tilstrækkelig historik · placeringsskala 0–100</caption><thead><tr><th>Emne</th><th>Nu</th><th>Tidligere median</th><th>Udsendelser</th></tr></thead><tbody>{evidence.comparisons.map(row => <tr key={row.topic}><td>{row.topic}</td><td>{Math.round(row.score)}</td><td>{Math.round(row.baseline)}</td><td>{row.count}</td></tr>)}</tbody></table></div>}
  </details>;
}

export function EditorialDecisionSupport({ rows, selected, asOf, audience = "", onOpen }: { rows: LiveMailing[]; selected: LiveMailing; asOf: string; audience?: string; onOpen?: (id: string) => void }) {
  const evidence = editorialDecisionEvidence(rows, { selected, asOf, audience });
  return <section className="panel evidence-decisions editorial-support"><div className="panel-header"><div><p className="eyebrow">Redaktionel beslutningsstøtte</p><h2>Hvad kan vi lære til næste nyhedsbrev?</h2></div><span>{audience || selected.type}</span></div>
    <p className="analysis-coverage-note">{selected.date} · sammenlignet med tidligere udsendelser i den valgte periode</p>
    <EditorialSignalCard evidence={evidence} scope={audience || selected.type} onOpen={onOpen} />
    <ComparisonBasis evidence={evidence} />
  </section>;
}
