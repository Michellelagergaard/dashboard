// Only explicit Ungapped tag names select these views; subjects are never used.
export const newsletterTags = ["Psykologernes Nyhedsbrev", "Kompetencenyt", "Magasinet P", "TR/AMR Nyt", "Netværksnyt"];
export const memberCommunicationTag = "Medlemskommunikation";
export const dashboardTags = [...newsletterTags, memberCommunicationTag];
const normalize = value => String(value || "").trim().normalize("NFKC").toLocaleLowerCase("da-DK");
export function matchingDashboardTags(tags = []) {
  return dashboardTags.filter(name => tags.some(tag => normalize(tag) === normalize(name)));
}
export function isMemberCommunication(mailing) {
  return mailing.dashboardTags?.includes(memberCommunicationTag) || mailing.type === memberCommunicationTag;
}
