# Indhold og redaktionelle rettelser — etape 2

## Bevarelse af historikken

`data/pre-editorial-v1.json` er en fuld kopi af det offentlige dashboard før denne etape. Tidligere arkiver bevares også. De oprindelige linktitler, målinger, målgrupper og rækker overskrives ikke af indholdsberigelsen.

Hvert nyhedsbrev får et separat `editorialCatalog` fra Ungappeds sendte `BodyHtml`. Kataloget hentes én gang pr. metodeversion for udgaver med eksisterende indholdsdata. Fejl ændrer ikke tidligere data og forsøges igen ved næste opdatering. Historiske klik genberegnes ikke. AutosavedHtml bruges ikke som dokumentation for udsendt indhold.

## Overskrifter og indholdstyper

HTML parses som et dokument med Cheerio. Et link kan kobles til en overskrift i samme afgrænsede afsnit, når der kun er én overskrift og én offentlig destination. Der søges højst 12 forældreniveauer op, aldrig til hele dokumentet. Overskrifter i h1–h4 prioriteres; entydig typografisk overskrift med mindst 20 px kan bruges. Ellers bevares linktekst eller billedets alt-tekst som tydeligt mærket fallback. Forskellige titler med samme prioritet til samme destination markeres som tvetydige.

Indholdstyper:

- **Nyheder og fagligt indhold:** Dokumenteret overskrift eller konkret rådgivnings-/nyhedsside. Omfatter også konkrete faglige tilbud; emnekategorien skelner emnet.
- **Servicelinks:** Kendte navigationsmål, Mit DP, generelle oversigter, DP-logo/forside og sociale profiler. Konkrete opslag på sociale medier behandles ikke som profil-links.
- **Til gennemgang:** Usikker type, tvetydige titler og generelle jobannonceadresser. De tidligere fjernede URL-parametre kan have adskilt flere annoncer; der opfindes ikke en entydig historie.

Alle typer er bevaret og kan vises. De automatiske emnekonklusioner bruger kun nyheder/fagligt indhold med dokumenteret kontaktmål fra etape 1. Servicelinks og usikkert indhold indgår ikke. Antal klik er ikke antal unikke personer på tværs af historier.

## Emneforslag

`config/editorial-topics.mjs` indeholder gennemskuelige nøgleordsregler. Overskrift vurderes før URL-sti. URL-stien afkodes, så danske bogstaver læses korrekt. Kurser/arrangementer og medlemsfordele/foreningsliv har hver sin kategori. “Andet” bruges ved manglende match. Et automatisk match er et forslag, ikke en dokumenteret redaktionel vurdering.

## Ret en historie

1. Åbn Udsendelse eller Målgrupper. Vælg eventuelt Alt indhold eller Til gennemgang.
2. Klik **Ret indhold** ved historien, ret overskrift, type og emne, og gem.
3. Rettelsen gælder linket i den konkrete udsendelse, inklusive alle målgruppevisninger. Den samme URL i andre udsendelser ændres ikke.

Lokale rettelser gemmes i browserens localStorage. De overlever almindelig genindlæsning og nye API-data, men ikke sletning af browserdata. Der vises fejl, hvis browseren ikke kan gemme. Oprindelige data ændres aldrig. **Fjern lokal rettelse** vender tilbage til en eventuel fælles rettelse eller automatisk forslag.

## Del rettelser

Nederst på dashboardet findes **Del og gem redaktionelle rettelser**:

- Eksportér en JSON-fil. Den indeholder både fælles og lokale rettelser; lokale har forrang.
- En kollega kan importere filen. Den valideres samlet, før noget gemmes. Kun sammenfaldende nøgler (udsendelses-id + destination) erstattes; andre rettelser bevares.
- For fælles publicering: Åbn `config/editorial-overrides.json` via GitHub-linket, indsæt filens indhold, og gem med GitHub-skriveadgang. Den eksisterende deployment gør rettelserne synlige for alle. Samordn ændringer med kolleger for ikke at overskrive nyere fælles rettelser.

Fælles rettelser valideres også i test. Frontenden har ingen GitHub-token eller API-nøgle, og lokal lagring foregiver ikke at være fælles lagring.
