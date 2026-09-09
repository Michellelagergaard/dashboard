# DP's udsendelsesdashboard

Analyse af Dansk Psykolog Forenings medlemskommunikation i Ungapped. Den offentlige dashboard-udgave viser et dataminimeret øjebliksbillede af godkendte udsendelsesdata.

## Indhold

- Overblik med centrale nøgletal og udvikling
- Søgbar oversigt over udsendelser
- Resultater pr. målgruppe og segment
- Datakvalitet og synkroniseringsstatus
- Responsivt layout og A4-udskrift

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

## Næste fase

1. Kortlæg Ungappeds officielle API og datafelter.
2. Implementér read-only hentning med `UG_API` i GitHub Actions.
3. Reducér rådata til godkendte optællinger og slet rådata efter kørslen.
4. Afstem nøgletal mod Ungapped.
5. Gennemfør GDPR-, sikkerheds- og fortrolighedsgodkendelse før udgivelse.
