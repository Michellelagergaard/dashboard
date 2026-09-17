# Redaktionelle beslutninger — etape 3

## Normalniveau

Normalniveauet er medianen af op til fem tidligere udgaver i den valgte periode. Mindst tre brugbare observationer kræves. Den valgte udgave og fremtidige udgaver indgår aldrig. Hver udgave vægter ens; ekstremværdier påvirker derfor ikke niveauet på samme måde som et gennemsnit.

Sammenligningen holder sig til samme målgruppe og højst ±25 % forskel i modtagerantal (for hele udsendelsen: leveringer). Det begrænser sammenblanding af store udsendelser og mindre deludsendelser. Filtreringen er en gennemsigtig redaktionel tommelfingerregel, ikke en statistisk model. Brugte datoer, værdier og antal kan foldes ud. Spændet i grafen er minimum–maksimum, ikke et konfidensinterval. Forskelle vises i procentpoint uden vurdering af statistisk signifikans.

Historik er **vejledende**: målinger har forskellig alder, og tidligere metoder er ikke fuldt dokumenteret. Udsendelser under syv døgn sammenlignes endnu ikke. Historiske værdier ændres ikke. Faste målepunkter bruger udelukkende samme dag og dokumenterede metodeversion. Ingen blanding af dag 1, dag 7 og historiske slutværdier.

## Faste målepunkter

For udsendelser fra **17. september 2026** registreres første vellykkede observation ved henholdsvis 24 og 168 timer efter den gemte afsendelsestid (`Ended` i Ungapped, altså afsluttet udsendelse). Den eksisterende timekørsel bruges. Tolerancen er højst seks timer efter måletidspunktet; faktisk tidspunkt og alder gemmes og vises. Intet opsamles før tidspunktet.

Et overskredet vindue er et mistet målepunkt. Historiske værdier, interpolerede tal eller nutidige opslag bruges aldrig til at udfylde det. Hvis målgruppeopslag mangler eller først afsluttes efter vinduet, forbliver målgruppen tom ved dette målepunkt. Første gyldige observation er uforanderlig.

Der gemmes aggregerede leveringer, åbninger/klik som rater, afmeldinger, metodeversion og de tilgængelige aggregerede målgrupper. Ingen kontaktregistre eller personhændelser. Linktabeller har fortsat løbende/historiske værdier og foregiver ikke at være faste indholdsmålinger.

Den daglige drift gemmer `checkpoints.json` i den separate GitHub-gren **data/measurement-checkpoints**. Opdateringer er tilføjelser med almindelige commits og uden force-push. En samtidig ændring genindlæses og flettes; eksisterende punkter har forrang. Main-kode og andre filer ændres ikke af arkivjobbet. Arkivet gendannes før hver import, så det ikke afhænger af GitHub Actions-cache. Fejl ved læsning eller skrivning standser publiceringen; seneste gyldige side bevares.

Målgruppernes medlemsstatus ved afsendelse kontra opslag er fortsat uafklaret. Ens målealder løser ikke dette spørgsmål eller spørgsmålet om automatiske åbninger/klik.

## Mødeoverblik og noter

Overblik, Målgrupper og Udsendelse har samme målevalg og grafforklaring. Klik vises først; åbninger er et særskilt valg. Manglende observationer er huller, ikke nuller. Grafen viser som udgangspunkt de seneste tolv udgaver frem til den valgte udsendelse. Præcise værdier kan læses i en tabel.

Dokumenterede observationer angiver kilde og afgrænsning. Linkrangering bruger kun nyheder med dokumenteret kontaktmål for enkeltplaceringer. Servicelinks, ukendte mål og minimumstal fra gentagne linkplaceringer indgår ikke i denne rangering. Redaktionelle emneforslag er stadig forslag.

Redaktionens egne vurderinger, beslutninger, opfølgningsdato og status gemmes separat pr. udsendelse og eventuel målgruppe. De er lokale i browseren, kan eksporteres/importeres og kan deles via `config/editorial-notes.json` med GitHub-skriveadgang. Nyeste ændringstidspunkt vinder ved import; andre noter bevares. Fælles filer vises offentligt på det eksisterende dashboard. Der er ingen automatisk publicering af browsernoter.
