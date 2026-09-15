# DP's udsendelsesdashboard

Et enkelt redaktionelt dashboard for udsendelser, der har det faktiske Ungapped-tag **Psykologernes Nyhedsbrev**. GitHub Actions henter et dataminimeret øjebliksbillede; browseren kalder aldrig Ungapped direkte.

## Indhold

- Seneste udsendelse, centrale nøgletal og mest klikkede links
- Udvikling i åbninger og klik
- Verificerbare resultater for de definerede målgrupper
- Regelbaserede emnekategorier og dokumenterede redaktionelle konklusioner
- Detaljer for én valgt udsendelse

Det fulde data- og beregningsgrundlag er beskrevet i [Ungapped data catalogue](docs/api-data-catalog.md).

## Lokal udvikling

```bash
npm ci
npm run dev
```

Byg og test:

```bash
npm run build
npm test
```

## Datasikkerhed

- Koden må ikke indeholde API-nøgler, kontaktdata eller rå API-svar.
- Udvikling og test bruger syntetiske data.
- Ungapped-nøglen skal senere gemmes som GitHub Secret `UG_API`.
- Dataudtrækket skal anonymisere og kontrollere output før publicering.
- Grupper under fem personer skjules eller sammenlægges; krydstabeller kræver mindst 25 personer pr. celle.

## Foreløbig struktur

- `app/dashboard.tsx`: visninger og interaktioner
- `app/mock-data.ts`: syntetisk datagrundlag
- `app/globals.css`: design og responsivitet
- `.github/workflows/ci.yml`: automatisk build og test

## Bevidste begrænsninger

- Dashboardet gætter ikke udsendelsestype ud fra volumen eller ugedag.
- Målgruppetal vises kun, når API'et bevisligt anvender kontaktfilteret.
- Linktitler udledes af udsendelsens dokumenterede linktekst; destinationen vises som kontrolspor.
- Et målgruppefiltreret klik dokumenterer målgruppens reaktion, men ikke at indholdet var eksklusivt for målgruppen.
- Summer over flere udsendelser kaldes leveringer, ikke unikke personer.
- Åbninger er et udviklingssignal, som påvirkes af mailklienters privatlivsbeskyttelse.
