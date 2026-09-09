// Den centrale definition af DP's medlemssegmenter i Ungapped.
// Feltet er kontaktfeltet "Sektioner (Medlemskaber)" / API-navnet Custom3.
// Kun aggregerede resultater med mindst fem modtagere må publiceres.
export const memberSegmentField = "Custom3";
export const memberSegmentFieldLabel = "Sektioner (Medlemskaber)";
export const minimumPublicSegmentSize = 5;

export const memberSegments = [
  { value: "Selvstændige psykologers sektion", label: "Selvstændige" },
  { value: "Hospitalssektionen", label: "Regionalt ansatte" },
  { value: "Kommunalt ansatte psykologers sektion", label: "Kommunalt ansatte" },
  { value: "Privat ansatte psykologers sektion", label: "Privatansatte" },
  { value: "Universitetssektionen", label: "Statsansatte" },
  { value: "Studentersektionen", label: "Studerende" },
  { value: "1 og 2 års kandidater", label: "Dimittender" },
  { value: "Ledig DP", label: "Ledige" },
  { value: "Ledersektionen", label: "Ledere" },
  { value: "Har ydernummer", label: "Ydernummerpsykologer" },
  { value: "Pension DP", label: "Pensionister" },
];

export const memberSegmentNames = memberSegments.map(segment => segment.label);
