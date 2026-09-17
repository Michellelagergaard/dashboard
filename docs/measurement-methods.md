# Målegrundlag – etape 1, 17. september 2026

## Bekræftet med API-kontrol

Tre seneste udsendelser med tagget Psykologernes Nyhedsbrev blev kontrolleret
via eksisterende read-only endepunkter, uden at læse kontakter:

- `/Issues/{id}/Statistics/Overview` indeholder RecipientCount, ReceivedCount,
  FailedCount, BounceCount, OpenCount, ClickCount og tilhørende procenter.
  ClickCount / ReceivedCount * 100 stemte med ClickPercentage i kontrollen.
- `/Issues/{id}/Statistics/Links` gav henholdsvis 26, 28 og 29 rækker, alle med
  både ContactCount og ClickCount samt de tilhørende procentfelter.
- `/Issues/{id}` indeholder BodyHtml, DynamicSubject og en Segments-liste.
  Segmentlisten i de undersøgte udsendelser indeholder ID, navn og ejerrelation;
  den beskriver ikke modtagerantal pr. indholdsblok.

Kontrol: https://github.com/Michellelagergaard/dashboard/actions/runs/35193898904

## Beregninger og betegnelser

| Visning | Grundlag |
| --- | --- |
| Modtagere | RecipientCount – ikke ReceivedCount |
| Leverede | ReceivedCount; et dokumenteret nul bevares som nul |
| Åbningsrate | OpenCount / leverede * 100 |
| Klikrate for udsendelse/målgruppe | ClickCount / leverede * 100 |
| CTOR | ClickCount / OpenCount * 100 |
| Link: unikke kontakter | ContactCount (eller et eksplicit UniqueClick-felt) |
| Link: samlede klik | ClickCount/Clicks, kun når kontaktmålet mangler; tydeligt mærket |
| Link: historisk klikmål | Gemt tal uden målefelt i den historiske eksport |
| Linkrate, hele udsendelsen | Linkmålet / leverede * 100 |
| Linkrate, målgruppe | Linkmålet / målgruppens modtagere * 100 |

Et linkforholdstal er ikke dokumentation for andelen af eksponerede for den
enkelte nyhed. Nævneren er hele udsendelsen/målgruppen. Samlede klikhændelser
må ikke beskrives som unikke personer. Oversigtens feltnavne dokumenterer ikke
i sig selv unikhed eller filtrering af automatiske åbninger/klik; brugerfladen
kalder derfor ikke oversigtens rate en human rate eller et verificeret unikt mål.

Hvis flere linkplaceringer ender på samme sanitiserede destination, bruger vi
det højeste kontaktantal som en nedre grænse og mærker det som minimum. Vi
summerer ikke unikke kontakter fra forskellige placeringer. Klik fra forskellige
personer kan ikke deduplikeres ud fra de aggregerede tal.

Målgruppegennemsnit vægtes med leverede mails, hvis alle indgående rækker har
gemte leveringstal. Ellers bruges et tydeligt mærket uvægtet gennemsnit pr.
udgave. Modtagere bruges aldrig som erstatning for manglende leveringer.

## Historik og ændringsspor

`data/pre-measurement-v2.json` bevarer den komplette offentlige eksport fra før
ændringen: 42 udgaver, inklusive alle fire nyligt tilføjede målgrupper. Arkivet
er versionsstyret og bruges også som reserve, hvis Actions-cachen mangler.
Det er et uændret arkiv; det genberegnes eller overskrives ikke af importen.

Metodeversion 2 gemmes for nye importer sammen med nævner og kildefelter.
Nye linkrækker gemmer klikmål, kildefelt, antal kilder og sammenlægningsmetode.
Eksisterende historiske rækker får ikke tilskrevet en måledefinition bagudrettet.
Deres værdier og gentagne linkplaceringer bevares, og de vises som historiske.
Emnekonklusioner bruger kun rækker med et eksplicit kontaktmål. Historiske rækker
kan fortsat læses i tabellerne, men blandes ikke med verificerede mål i disse
automatiske summer. Summer pr. emne er fortsat ikke unikke personer.

## Målretning og medlemsstatus – kendte begrænsninger

HTML'en indeholder referencer til Custom3, CustomLong1, CustomLong2 og Custom7,
og dynamiske emnefelter indeholder målgrupperegler. Det bekræfter, at relevante
regelspor findes, men det er ikke en færdig kortlægning af eksponeringen for
hver nyhed. Regler, prioritet, alternative grene og gentagne linkplaceringer
skal fortolkes samlet, før indhold kan mærkes fælles eller målrettet.

En supplerende strukturkontrol fandt 20, 20 og 15 div-elementer med feltreferencer
i de tre HTML'er. De bruger `ug-targetaudience-conditions`,
`ug-targetaudience-relation`, `ug-targetaudience-property`,
`ug-targetaudience-operator` og `ug-targetaudience-value`. Disse attributter er
grundlaget for næste etapes indholdskortlægning; simple Handlebars-if-blokke
er ikke tilstrækkelige. Ingen rå modtageroplysninger blev hentet.

Derfor hedder det hidtidige "Fælles indholdsresultat" nu "Samlet resultat for
udsendelsen". Et kontaktfilter dokumenterer målgruppefordelte klik, ikke
eksklusiv målretning. Målgrupper kan overlappe.

Ingen af de undersøgte statistik-/udsendelsessvar dokumenterer, om kontaktfiltre
anvender medlemsstatus ved afsendelsen eller ved opslaget. Det spørgsmål er
fortsat uafklaret og skal bekræftes af leverandøren eller en dokumenteret
snapshotfunktion, før der drages konklusioner om medlemsbestandens historik.
Der er ikke ændret på medlemsdata for at teste dette.

Officiel baggrund om sporing:
https://ungapped.com/support/user-manuals/manual-for-mailings-newsletters/tracking-opens-clicks/
