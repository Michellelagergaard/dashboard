// Den centrale definition af DP's medlemssegmenter i Ungapped.
// Sektioner bruger Custom3; medlemskab CustomLong1; egne felter CustomLong2.
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
  { value: "1 og 2 års kandidater", label: "Dimittender", field: "CustomLong1" },
  { value: "Ledig DP", label: "Ledige", field: "CustomLong1" },
  { value: "Ledersektionen", label: "Ledere" },
  { value: "Har ydernummer", label: "Ydernummerpsykologer", field: "CustomLong2" },
  { value: "Pensionist DP", label: "Pensionister", field: "CustomLong1" },
];

export const memberSegmentNames = memberSegments.map(segment => segment.label);
export const correctedMemberSegments = memberSegments.filter(segment => segment.field);
export const segmentMappingVersion = 1;
