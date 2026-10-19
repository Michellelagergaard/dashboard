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

`config/editorial-topics.mjs` indeholder gennemskuelige nøgleordsregler. Overskrift vurderes før URL-sti. URL-stien afkodes, så danske bogstaver læses korrekt. Kategorierne tager udgangspunkt i nyhedens primære medlemsværdi: politik og interessevaretagelse; løn, overenskomst og ansættelse; arbejdsmiljø og trivsel; autorisation, tilsyn og regler; faglighed og praksis; karriere og job; kurser og arrangementer; medlemsfordele; foreningsliv og demokrati; samt praksis og ydernummer. “Andet” bruges ved manglende match. Et automatisk match er et forslag, ikke en dokumenteret redaktionel vurdering.

## Fælles rettelser efter afvikling af manuel redigering

Dashboardet er en læsevisning. Historier kan ikke længere redigeres eller nulstilles i brugerfladen. Det gamle delingspanel med import, samlet eksport og GitHub-redigeringslink samt den ubrugte `ContentEditor` er fjernet. Dashboardets almindelige delingslinks er uændrede.

`config/editorial-overrides.json` er fortsat kilden til godkendte fælles rettelser. Filen, historiske data, kataloger og emneregler er bevaret. `EditorialData` indlæser rettelserne, og `enrichMailings` anvender dem på indhold, links og målgrupper før analyserne beregnes. Rettelser er afgrænset til udsendelses-id + destination; oprindelige titler og målinger overskrives ikke.

Vedligeholdelse af fælles rettelser sker som en gennemgået kodeændring til `config/editorial-overrides.json`. Bevar eksisterende rækker, validér hele filen med `validateCorrections`, gennemgå forskellen og kør `npm test`, `npm run lint` og `npm run build:pages` før publicering. Der ligger ingen GitHub-token eller API-nøgle i frontenden.

## Gamle browserlokale rettelser

Nøglen `dp-editorial-corrections-v1` i localStorage læses fortsat på samme origin (protokol + domæne + port). Gyldige gamle rettelser har fortsat forrang for fælles rettelser med samme udsendelses-id + destination. De ændrer derfor fortsat både visninger og afledte analyser i den pågældende browser. Ingen kode migrerer, overskriver eller sletter den lokale fil.

- En browser uden lokale rettelser viser intet ekstra panel.
- En browser med gamle rettelser viser en synlig besked og **Hent sikkerhedskopi af gamle rettelser**. Downloaden indeholder præcis den oprindelige lokale streng, ikke en sammenfletning med de fælles rettelser. Den omfatter også rettelser til udsendelser uden for den valgte periode.
- En beskadiget eller ikke længere gyldig fil udløser en fejlbesked og kan stadig hentes uændret. Fælles rettelser anvendes som fallback; den lokale fil forbliver urørt.
- Hvis lagringen er blokeret, vises en besked. Fælles rettelser bruges, indtil browseren igen giver adgang til lokale rettelser. En fil, der ikke kan læses, kan ikke sikkerhedskopieres fra dashboardet.

Kontrollér, at sikkerhedskopien faktisk er gemt, før browserdata slettes. Opdatering og almindelig genindlæsning sletter ikke lokale rettelser, men sletning af browserdata eller et skift af origin kan gøre dem utilgængelige. Vi kan ikke fra repositoryet afgøre, om en bestemt brugers browser indeholder rettelser.

Et delt dashboardlink indeholder kun navigationsvalg, aldrig lokale rettelser. Modtageren ser fælles rettelser samt eventuelle gamle rettelser i sin egen browser. Lokale sikkerhedskopier må ikke erstatte den fælles fil ukritisk: gennemgå og indarbejd kun godkendte rækker i en separat kodeændring. Denne oprydning publicerer ingen lokale rettelser automatisk.

## Kontrol af oprydningen

`tests/editorial-content.test.mjs` kontrollerer fortsat titler, emner, validering, uændrede målinger og det komplette arkiv. `tests/legacy-corrections.test.mjs` dækker tom, gyldig, beskadiget og blokeret lokal lagring samt forrang, målgruppefelter og uændret rå sikkerhedskopi. Navigation og delingsparametre dækkes fortsat af `tests/data.test.mjs`.
