import "server-only";
import { fetchSentIssues } from "../scripts/ungapped-client.mjs";

export type ClickMeasurement = {
  metric: "unique-contacts" | "total-clicks";
  source: string;
  aggregation: "single-link" | "max-per-destination";
  sourceRows: number;
};
export type EditorialMetadata = { mailingId: string; title: string; kind: string; category: string; source: string; ambiguous?: boolean; audienceScope?: "all" | "targeted" | "unknown"; audiences?: string[] };
export type Checkpoint = { mailingId: string; day: number; capturedAt: string; ageHours: number; sentAt: string; delivered: number; openRate: number; clickRate: number; unsubscribes: number; measurementVersion: number; measurement?: LiveMailing["measurement"]; segmentPerformance: NonNullable<LiveMailing["segmentPerformance"]>; segmentsObservedAt: string | null };
export type LiveMailing = {
  checkpoints?: Checkpoint[];
  observedAt?: string;
  editorialCatalogVersion?: number;
  editorialCatalog?: Array<{ destination: string; title: string; titleSource: string; ambiguous?: boolean; audienceScope?: "all" | "targeted" | "unknown"; audiences?: string[] }>;
  id: string;
  title: string;
  subject: string;
  type: string;
  date: string;
  sentAt: string | null;
  delivered: number;
  measurementVersion?: number;
  linkMeasurementVersion?: number;
  measurement?: { overviewSource: string; openSource: string; clickSource: string; denominator: string; deliverySource: string; uniqueness: string };
  openRate: number;
  clickRate: number;
  unsubscribes: number;
  content: Array<{
    editorial?: EditorialMetadata;
    title: string;
    destination: string;
    recipients: number;
    clicks: number;
    rate: number;
    clickMeasurement?: ClickMeasurement;
  }>;
  links: Array<{
    editorial?: EditorialMetadata;
    title?: string;
    destination: string;
    firstPosition: number;
    occurrences: number;
  }>;
  segments: string[];
  segmentMappingVersion?: number;
  segmentLinkMappingVersion?: number;
  segmentPerformance?: Array<{
    name: string;
    recipientsLabel: string;
    recipients?: number;
    delivered?: number;
    measurementVersion?: number;
    membershipTimeBasis?: string;
    openRate: number;
    clickRate: number;
    ctor: number;
    unsubscribes: number | null;
  }>;
  segmentSubjects?: Array<{
    audience: string;
    subject: string;
  }>;
  segmentLinkPerformance?: Array<{
    editorial?: EditorialMetadata;
    title: string;
    destination: string;
    audience: string;
    clicks: number;
    rate: number;
    clickMeasurement?: ClickMeasurement;
  }>;
  dataCoverage?: {
    linkPerformance: boolean;
    segmentPerformance: boolean;
    segmentSubjects: boolean;
    segmentLinkPerformance: boolean;
  };
};

export type LiveDashboardData = {
  mailings: LiveMailing[];
  updatedAt: string | null;
  status: "live" | "snapshot" | "unavailable";
};

type UngappedIssue = {
  id: string;
  name?: string;
  subject?: string;
  category?: string;
  suggestedCategory?: string | null;
  sentAt: string | null;
  delivered: number;
  openRate?: number | null;
  clickRate?: number | null;
  unsubscribes?: number | null;
  classificationMetadata?: { segments?: string[] };
};

export async function getLiveDashboardData(): Promise<LiveDashboardData> {
  const apiKey = process.env.UG_API;
  if (!apiKey) return { mailings: [], updatedAt: null, status: "unavailable" };

  try {
    const issues = await fetchSentIssues(apiKey) as UngappedIssue[];
    const mailings = issues
      .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))
      .map((issue) => ({
        id: issue.id,
        title: issue.name || issue.subject || "Uden titel",
        subject: issue.subject || "Emnefelt mangler",
        type: issue.category && issue.category !== "Ikke kategoriseret"
          ? issue.category
          : issue.suggestedCategory || "Ikke kategoriseret",
        date: formatDate(issue.sentAt),
        sentAt: issue.sentAt,
        delivered: issue.delivered,
        openRate: issue.openRate ?? 0,
        clickRate: issue.clickRate ?? 0,
        unsubscribes: 0,
        content: [],
        links: [],
        segments: issue.classificationMetadata?.segments || [],
      }));
    return { mailings, updatedAt: new Date().toISOString(), status: "live" };
  } catch {
    return { mailings: [], updatedAt: null, status: "unavailable" };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Dato mangler";
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Copenhagen" }).format(new Date(value));
}
