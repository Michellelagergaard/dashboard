# Opdatering hver time via Cloudflare

Status: **Klargjort, ikke aktiveret.** Disse filer ændrer ikke den nuværende drift, før en administrator har oprettet og aktiveret en Worker.

GitHubs planlagte kørsler er best effort og kan blive forsinket eller udeladt. Denne Worker bruger Cloudflares tidsplan til at starte det eksisterende Pages-workflow ved minut 13 hver time. Dashboardets adresse, databehandling og Ungapped-nøgle bliver i GitHub.

Det er en uafhængig tidsplan, ikke en garanti for, at nye data er offentliggjort præcis hvert 60. minut: GitHub skal stadig hente data, bygge og publicere, og begge tjenester kan fejle. En allerede åben dashboardfane skal genindlæses for at vise den nye version.

## Aktivering

1. Log ind på en Cloudflare-konto med adgang til Workers. Kontroller kontoens aktuelle priser og vilkår før aktivering.
2. Opret en fine-grained GitHub personal access token. Vælg kun repositoryet `Michellelagergaard/dashboard` og repositorytilladelsen **Actions: Read and write**. Brug en udløbsdato efter organisationens regler, og aftal fornyelse. Nøglen kan starte workflows; den skal derfor behandles som en hemmelighed.
3. Fra repositoryets rod køres følgende med den allerede installerede Wrangler:
   ```sh
   npx --no-install wrangler login
   npx --no-install wrangler deploy --config ops/hourly-refresh/wrangler.json
   npx --no-install wrangler secret put GITHUB_ACTIONS_TOKEN --config ops/hourly-refresh/wrangler.json
   ```
   Indtast nøglen i Wranglers skjulte prompt. Gem den aldrig i kode, chat eller versionsstyring. En kørsel mellem deploy og tilføjelse af nøglen vil fejle uden at sende noget.
4. Kontroller Cloudflare Workerens Cron Trigger og den næste kørsel. Nye tidsplaner kan tage op til 15 minutter om at slå igennem.
5. Bekræft i GitHub Actions, at en ny **workflow_dispatch**-kørsel af `pages.yml` gennemfører både build og deploy. Bekræft derefter, at dashboardets "Senest opdateret" er ændret. Et accepteret startkald er ikke bevis for en gennemført opdatering.
6. Efter mindst to efterfølgende timekørsler er bekræftet, kan `schedule`-blokken i `.github/workflows/pages.yml` fjernes for at undgå dobbeltkørsler. Bevar `push` og `workflow_dispatch`. Indtil da er GitHubs tidsplan en ekstra reserve.

## Fejl og overvågning

Workerens kørsler og fejl vises i Cloudflare Observability. Fejl skjules ikke, og logs indeholder hverken token eller API-svar. Ved HTTP 401/403 kontrolleres nøglens udløb og adgang. Ved 404 kontrolleres repository- og workflowadgang. Kontroller også GitHub Actions for build- og deployfejl. Automatisk alarmlevering er ikke konfigureret her; vælg en driftsansvarlig og alarmkanal ved aktivering.

Kaldet gentages ikke automatisk efter en netværksfejl: GitHub kan allerede have accepteret det. Kontroller Actions før manuel genstart. Eksisterende Pages-concurrency begrænser overlappende builds.

## Test

```sh
node --test ops/hourly-refresh/worker.test.mjs
```

Testene foretager ingen netværkskald og bruger kun en syntetisk nøgle.

## Deaktivering

Sæt `triggers.crons` til `[]` og deploy igen. Hvis GitHubs reserveplan blev fjernet, skal den gendannes først. Slet derefter Workerens hemmelighed og tilbagekald GitHub-nøglen, hvis løsningen tages ud af drift.

## Dokumentation

- [GitHub: forsinkede planlagte kørsler](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)
- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [GitHub workflow dispatch og adgangskrav](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
