import { memberSegmentNames } from "./member-segments.mjs";
export const noteKey = row => JSON.stringify([row.mailingId,row.audience]);
export function validateNotes(file) {
  if (file?.version !== 1 || !Array.isArray(file.notes) || file.notes.length>5000) throw Error("Vælg en notefil i version 1.");
  const keys=new Set();
  const notes=file.notes.map(row=>{
    if (!row || typeof row.mailingId!=="string" || !row.mailingId || !(row.audience===""||memberSegmentNames.includes(row.audience))) throw Error("Noten mangler en gyldig udsendelse eller målgruppe.");
    for (const field of ["observation","decision"]) if (typeof row[field]!=="string"||row[field].length>2000) throw Error("Notetekst må højst være 2.000 tegn pr. felt.");
    if (!["open","done"].includes(row.status) || typeof row.followUp!=="string" || (row.followUp!=="" && (!/^\d{4}-\d{2}-\d{2}$/.test(row.followUp)||!Number.isFinite(Date.parse(row.followUp))))) throw Error("Ugyldig status eller opfølgningsdato.");
    if (!Number.isFinite(Date.parse(row.updatedAt)) || keys.has(noteKey(row))) throw Error("Dubleret note eller manglende ændringstidspunkt.");
    keys.add(noteKey(row));
    return { mailingId:row.mailingId,audience:row.audience,observation:row.observation,decision:row.decision,status:row.status,followUp:row.followUp,updatedAt:row.updatedAt };
  });
  return {version:1,notes};
}
export function mergeNotes(saved,incoming) {
  validateNotes(saved);validateNotes(incoming);
  const merged=new Map(saved.notes.map(row=>[noteKey(row),row]));
  for(const row of incoming.notes) {const previous=merged.get(noteKey(row));if(!previous||Date.parse(row.updatedAt)>Date.parse(previous.updatedAt))merged.set(noteKey(row),row);}
  return {version:1,notes:[...merged.values()]};
}
