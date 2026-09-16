# Målgrupper i Ungapped

Kontrolleret mod kontoens API 16. september 2026. Eksisterende sektionsgrupper
bruger fortsat Custom3. De fire supplerende grupper bruger følgende felter:

| Dashboard | API-felt | Tekst i filter |
| --- | --- | --- |
| Dimittender | CustomLong1 | 1 og 2 års kandidater |
| Ledige | CustomLong1 | Ledig DP |
| Pensionister | CustomLong1 | Pensionist DP |
| Ydernummerpsykologer | CustomLong2 | Har ydernummer |

`Pension DP` gav under fem modtagere; `Pensionist DP` gav 707 i den
kontrollerede udsendelse. Brug ikke en bred søgning efter `Pension`, som gav
710 og dermed en anden afgrænsning. Ydernummerreglen i DynamicSubject bruger
teksten `Har Ydernummer`, ikke en boolesk værdi. API-filteret matchede også
`Har ydernummer`.

Bekræftelsen blev udført med udsendelsesskabeloner og aggregeret statistik,
uden at hente kontakter. Diagnostikkørsler:
- https://github.com/Michellelagergaard/dashboard/actions/runs/35072418901
- https://github.com/Michellelagergaard/dashboard/actions/runs/35072646021

Filtrene anvendes både på oversigtsstatistik og linkstatistik. Grupper kan
overlappe; deres modtagertal må ikke summeres som unikke personer.

## Bevarelse af historik

Den eksisterende version 2-cache og den versionsstyrede baseline læses stadig.
Historiske udgaver suppleres kun med manglende grupper. Eksisterende totaler,
emnefelter, indhold og grupper bevares. Rækker flettes efter deres identitet,
så et delvist API-svar ikke erstatter en komplet historisk liste.

En versionsmarkering forhindrer gentagen supplering efter en vellykket
kørsel. Fejlede statistikopslag kan forsøges igen. Nye cachekopier har unikke
kørselsnøgler og kan fortsat gendanne historik fra de tidligere cache-nøgler.

Historiske gruppetal er hentet med Ungappeds kontaktfiltre på kontroltidspunktet.
Det er ikke verificeret, om API'et bruger medlemsstatus på afsendelsesdatoen
eller den aktuelle medlemsstatus. Tallene må derfor ikke beskrives som en
dokumenteret historisk medlemsbestand.
