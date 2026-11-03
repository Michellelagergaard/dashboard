# Redaktionel beslutningsstøtte

Formålet er at finde en konkret ændring i indholdets relative klikplacering, som redaktionen kan undersøge. En topscorer eller et hyppigt kerneemne giver ikke længere automatisk et råd. Systemet analyserer ikke historiens tekst og kan ikke slutte, at en rubrik, vinkel eller serviceform skabte klikkene.

## Sammenligning

- Valgt udsendelse sammenlignes kun med tidligere udsendelser af samme nyhedsbrev, inden for valgt periode og målgruppe. Senere udsendelser udelades. Ved valg af en målgruppe bruges kun dens egne linkdata; der er ingen tilbagefald til hele nyhedsbrevet.
- Udsendelsen skal være mindst syv dage gammel og have mindst fire historier med præcise kontaktmål fordelt på mindst to emner. Historiske sammenligningsudsendelser skal opfylde samme krav og have samme `linkMeasurementVersion` (inklusive bevaret, uversioneret historik med samme eksplicitte kontaktmål).
- Kun dokumenterede `unique-contacts` med `single-link`-aggregering bruges. Nul klik indgår. Ukendte målinger, minimumstal fra gentagne placeringer, servicelinks, uklare titler og ukendte emner udelades. P bruger sine egne artikelkategorier.
- Trackingparametre, fragmenter, www og afsluttende skråstreg normaliseres ved kontrol af destinationer. Flere placeringer af samme destination udelukkes fra præcise rangeringer. Der summeres aldrig kontaktantal.
- Historiernes klikplacering inden for en udsendelse omregnes til 0–100: bund = 0, top = 100. Delte placeringer får deres gennemsnitlige placering. Medianen for emnets historier beregnes pr. udsendelse. Historisk niveau er medianen af disse udgaveværdier; alle udgaver vægter lige meget. Metoden belønner ikke automatisk antallet af historier i en kategori og sammenligner ikke rå klikantal på tværs af udsendelser.
- Et emne kræver mindst tre tidligere udsendelser og tre forskellige tidligere historier. Højst de fem nyeste kvalificerede udsendelser bruges. Den aktuelle udsendelse indgår ikke i historikken.
- En forskel fremhæves ved mindst 25 point på placeringsskalaen og en værdi uden for alle de historiske udgaveværdier. Mindst én historie i den aktuelle udsendelses sammenligningsfelt skal have 25 kontaktklik. Disse grænser er eksplicitte redaktionelle screeningsregler, ikke statistisk signifikans. Ved flere afvigelser vises den største absolutte forskel; den er ikke en rangering af medlemsværdi.

## Visning og næste skridt

Boksen viser emnet, forskellens retning og alle aktuelle sammenlignelige historier om emnet. Tidligere sammenligningshistorier kan foldes ud. Hver historie har titel, dato, klikplacering, feltets størrelse, kontaktantal og adgang til artiklen og udsendelsen. Klikplacering er ikke placering i mailens layout.

Redaktionsspørgsmålet er at undersøge forskellene mellem de konkrete historier, før indhold prioriteres eller ændres. Der gives ikke længere faste råd knyttet til en kategori eller en generisk afprøvning efter to udsendelser. Beslutningsstøtten vises kun på nyhedsbrevenes egne sider.

Manglende linkdata, unge udsendelser, få sammenlignelige historier, utilstrækkelig historik og tilstrækkelige data uden en tydelig afvigelse har særskilte forklaringer. Metode, dækningsgrad og alle beregnelige emners aktuelle og historiske værdier ligger under “Se grundlag og begrænsninger”.

## Begrænsninger

Klikplacering er relativ: Et emne kan rykke ned, fordi en anden historie rykker op. Eksponering, mailplacering, emnemiks, forskellig målealder og automatiserede klik er ikke kontrolleret. Syv dages minimumsalder er ikke et fast linkmålepunkt. Gentagelser og relative ændringer dokumenterer hverken årsag, menneskelige klik, læsning, kvalitet eller medlemsværdi. Data og historiske målinger ændres ikke af analysen.
