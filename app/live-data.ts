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
};

export type LiveDashboardData = {
  mailings: LiveMailing[];
  updatedAt: string | null;
  status: "live" | "snapshot" | "unavailable";
};

export async function getLiveDashboardData(): Promise<LiveDashboardData> {
  const apiKey = process.env.UG_API;
  if (!apiKey) return { mailings: [], updatedAt: null, status: "unavailable" };

  try {
    const issues = await fetchSentIssues(apiKey);
    const mailings = issues
      .sort((a: any, b: any) => String(b.sentAt).localeCompare(String(a.sentAt)))
      .map((issue: any) => ({
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
