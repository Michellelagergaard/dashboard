# Hovedhistorie og emnefelt til næste udsendelse

Beslutningsstøtten skal hjælpe redaktionen med at vælge en aktuel hovedhistorie og formulere næste udsendelses emnefelt. Historiske referencer er faktiske afsendte emnefelter, ikke brede indholdskategorier eller automatisk udpegede topscorere. Visningen findes på nyhedsbrevenes egne sider og målgruppesider, aldrig på forsiden.

## Referencer og målgrupper

- Referencer kommer kun fra samme `type` som den valgte udsendelse, inden for valgt periode og senest på den valgte udsendelses afsendelsestidspunkt. Dublerede udsendelses-id'er tælles én gang.
- Psykologernes Nyhedsbrev kræver et valg af målgruppe. Det samme gælder andre nyhedsbreve med dokumenterede emnefeltvarianter. På en målgruppeside bruges allerede valgt målgruppe.
- En målgruppevariant læses fra `segmentSubjects`. Manglende eller modstridende varianter erstattes aldrig med det fælles emnefelt eller en anden målgruppes variant. For nyhedsbreve uden varianter bruges det faktisk gemte fælles `subject`.
- Uafklarede emnefelter, skabelonkode og pladsholdertekster udelades. Manglende emnefelter oplyses i grundlaget. Et manglende emnefelt blokerer ikke arbejdet med næste kladde.
- Referencer vises kronologisk. En moden reference vælges som udgangspunkt, når den seneste endnu er under syv dage. Foreløbige udsendelser kan vælges, men får ingen konklusion om forskel fra normalt niveau.
- Søgning filtrerer kun de faktiske emnefelter i den valgte afgrænsning. Alle søgeord skal forekomme. Søgningen ændrer ikke beregningsgrundlaget for udsendelsens resultater.

## Historier nævnt i emnefeltet

En historie forbindes kun med et emnefelt ved et entydigt match af hele den gemte overskrift med hele emnefeltet eller en hel del adskilt med `|` eller `•`. Kun forskelle i mellemrum, store/små bogstaver og Unicode-normalisering ignoreres. Der bruges ingen nøgleords- eller emnelighed og ingen antagelse om, at den mest klikkede historie også stod i emnefeltet.

Der kræves mindst 15 tegn i matchteksten. Flere forskellige destinationer med samme overskrift, tvetydige kildetitler og ugyldige adresser giver intet match. Eksplicit målrettet indhold til andre grupper bruges ikke som match for den valgte gruppe.

Kursus- og P-artikellinks kan kun optræde, hvis deres egen fulde overskrift faktisk matcher emnefeltet; de mærkes tydeligt som henholdsvis Kursus og P-artikel. Linkets destination er ikke dokumentation for udsendelsens nyhedsbrevstype. Det viste nyhedsbrev kommer altid fra den konkrete udsendelse.

Match er dokumentation for en overskrift nævnt i emnefeltet, ikke for at historien var mailens øverste hovedhistorie. Ved intet entydigt match vises denne begrænsning uden en erstatningshistorie. Alle fremhævede historier har direkte adgang til kilden; fra referencen kan den konkrete udsendelse åbnes.

Linkkontaktantal vises kun ved ét præcist `unique-contacts`-mål med `single-link`-aggregering for samme målgruppe. Ved manglende målgruppeklik bruges hele udsendelsens klik aldrig som erstatning. Minimumsmål og gentagne placeringer får ingen opfundet præcis værdi. Nul bevares.

## Resultater som kontekst

Åbnings- og klikrater gælder udsendelsen eller den valgte målgruppe. De sammenlignes med samme nyhedsbrevs og målgruppes eget normale niveau via `normalLevel`: medianen af op til fem tidligere udsendelser med tilsvarende størrelse, mindst tre kræves. Baselines bruger samme nyhedsbrevs afgrænsede historik; senere udsendelser og andre nyhedsbreve indgår ikke.

Der udpeges ikke et bedst emnefelt ud fra raterne. Forskellig målealder, indhold, placering og eksponering kan påvirke resultaterne; åbninger kan være automatiske. Resultaterne dokumenterer ikke effekten af en bestemt formulering. Tidligere brede emnekategorier, normaliserede klikplaceringer og faste emneråd bruges ikke længere i denne visning.

## Næste udsendelses kladde

Redaktionen kan skrive kandidat til hovedhistorie, den vigtigste pointe for målgruppen og et udkast til emnefelt. Emnefeltet vises som forhåndsvisning med tegntal. De historiske referencer er inspiration; der genereres ikke automatisk nye historier eller løfter om en bestemt effekt.

Kladden gemmes kun ved et eksplicit klik på “Gem kladde i denne browser” i en ny lokal lagringsnøgle, `dp-next-issue-draft-v1:` efterfulgt af nyhedsbrev og målgruppe. Den indeholder også id'et på den valgte reference. Kladder til forskellige nyhedsbreve og målgrupper holdes adskilt. Historiske data, fælles rettelser, gamle browserrettelser og eksisterende redaktionsnoter ændres ikke. Kladden publiceres eller sendes ikke.

Ved en beskadiget gemt kladde deaktiveres overskrivning. Blokeret lagring forklares, og en fejl ved gemning efterlader teksten i felterne. Manglende lagring er aldrig præsenteret som en vellykket gemning.
