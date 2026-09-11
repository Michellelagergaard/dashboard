import "server-only";
import { fetchSentIssues } from "../scripts/ungapped-client.mjs";

export type LiveMailing = {
  id: string;
  title: string;
  subject: string;
  type: string;
  date: string;
  sentAt: string | null;
  delivered: number;
  openRate: number;
  clickRate: number;
  unsubscribes: number;
  content: Array<{
    title: string;
    destination: string;
    recipients: number;
    clicks: number;
    rate: number;
  }>;
  links: Array<{
    destination: string;
    firstPosition: number;
    occurrences: number;
  }>;
  segments: string[];
  segmentPerformance?: Array<{
    name: string;
    recipientsLabel: string;
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
    title: string;
    destination: string;
    audience: string;
    clicks: number;
    rate: number;
  }>;
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
        type: issue.category !== "Ikke kategoriseret"
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
