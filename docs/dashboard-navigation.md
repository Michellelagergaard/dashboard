# Navigation og pålidelige linkresultater — etape 1

## Del en analyse

Vælg side, periode, udsendelse og eventuelt målgruppe. **Del analyse** viser et link og en kopieringsknap. Linket bevarer valgene ved genindlæsning og hos en kollega. På Magasinet P bevares også emnet i artikellisten og valget mellem samlet volumen og artikelklikrate. Browserens frem- og tilbagefunktion gendanner navigationen.

URL-parametre: `page` (side), `period` (`6m`, `12m`, `all`), `issue` (udsendelses-id), `audience` (offentligt segmentnavn), `topic` (P-emne) og `rank` (`rate`). Ukendte værdier valideres; andre parametre kopieres ikke til delingslinket, bortset fra et kort versionsmærke `v`. Der deles ingen kontaktoplysninger eller browserlokale redaktionelle rettelser i linket. Linket viser valgene med dashboardets senest tilgængelige data, ikke en frossen kopi af tallene.

**Åbn** i udsendelsestabellerne vælger den konkrete udgave. PN åbner Redaktionel analyse; de øvrige nyhedsbreve åbner deres egen side med udgaven valgt. Der er udsendelsesvalg på alle fire øvrige nyhedsbrevssider. Hvis et delt udsendelses-id er ukendt eller ikke findes i den valgte periode, viser dashboardet en forklaring i stedet for at falde tilbage til en anden udsendelse. Ved periodeskift nulstilles udsendelsesvalget som dokumenteret i measurement-methods.md.

## Hold klikmål adskilt

Hovedrangeringer og automatiske fremhævelser bruger kun dokumenterede unikke kontaktmål. Samlede klikhændelser og historiske mål uden feltdefinition står i separate sektioner og indgår ikke i kontaktkonklusionerne. Historiske resultater bevares uden rangering på tværs af ukendte måletyper. Minimumsmålinger (`max-per-destination`) bevarer ≥-markeringen. De oprindelige kilder og tal ændres ikke.

## Samme emne og korrekt titel i Magasinet P

Magasinets artikeltemaer anvendes i alle P-visninger: emneoversigt, mest besøgte links og artikelrækker. PN beholder sin eksisterende emneinddeling.

Den misvisende linktekst "overgangsalder" i 17. april-udgaven peger på en anden artikel. Dashboardet viser nu den verificerede artikeltitel **Hvad gør vi, når den klassiske behandling ikke rækker?** fra https://www.dp.dk/p-psykologernes-fagmagasin/artikler/hvad-goer-vi-naar-den-klassiske-behandling-ikke-raekker/ . URL og de 30 gemte klik er uændrede. Dette korrigerer visningens titel, ikke den oprindeligt udsendte mails indhold.

En usikker artikelrubrik kan bruge en entydig overskrift for samme URL fra en anden udsendelse. Kilden mærkes særskilt. Redaktionelt kontrollerede overskrifter mærkes også korrekt og foregiver ikke at være en automatisk overskrift fra sendt HTML.

## Kontrol

Automatiske tests dækker delingslinkenes validering og gendannelse, måltypernes adskillelse, P's emner og rettelsen uden ændring af målinger. Interaktionstest dækker Åbn fra forsiden, målgruppe/udsendelse/periode, genindlæsning, delingsfelt og ukendte udsendelses-id'er.

## Medlemskommunikation

`page=member-communication` viser sendte udsendelser med det faktiske Ungapped-tag **Medlemskommunikation**. Siden har periodevalg, udsendelsesvalg, delingslink, åbninger, klik og alle udsendelser i perioden. Det er medlemsinformation og invitationer, ikke et nyhedsbrev. Forskellige formål og modtagere skal tages i betragtning ved sammenligning. Visningen indgår ikke i forsidens nyhedsbrevsbenchmark. Et tag på en udsendelse med et eksisterende nyhedsbrevstag bevares også i denne visning.
