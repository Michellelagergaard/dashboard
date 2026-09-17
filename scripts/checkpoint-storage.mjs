import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mergeCheckpointLedgers, validateCheckpointLedger } from "../config/decision-methods.mjs";
const branch = "data/measurement-checkpoints";
const path = new URL("../.cache/measurement-checkpoints.json", import.meta.url);
const empty = { version: 1, records: [] };
const git = (args, input) => execFileSync("git", args, { input, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "github-actions[bot]", GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com", GIT_COMMITTER_NAME: "github-actions[bot]", GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com" } }).trim();
function remote() {
  const ref = git(["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  if (!ref) return { sha: null, ledger: empty };
  git(["fetch", "--no-tags", "origin", `refs/heads/${branch}`]);
  const sha = git(["rev-parse", "FETCH_HEAD"]);
  return { sha, ledger: validateCheckpointLedger(JSON.parse(git(["show", `${sha}:checkpoints.json`]))) };
}
await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
if (process.argv[2] === "restore") {
  const { ledger } = remote();
  await writeFile(path, JSON.stringify(ledger)+"\n");
  console.log(`Faste målepunkter: ${ledger.records.length} gendannet fra versionshistorik.`);
} else if (process.argv[2] === "save") {
  const incoming = validateCheckpointLedger(JSON.parse(await readFile(path, "utf8")));
  for (let attempt=0; attempt<3; attempt++) {
    const { sha, ledger } = remote();
    const merged = mergeCheckpointLedgers(ledger,incoming);
    if (sha && JSON.stringify(merged) === JSON.stringify(ledger)) { console.log("Målepunktsarkivet er uændret."); break; }
    const blob = git(["hash-object", "-w", "--stdin"],JSON.stringify(merged)+"\n");
    const tree = git(["mktree"],`100644 blob ${blob}\tcheckpoints.json\n`);
    const commit = git(["commit-tree", tree, ...(sha ? ["-p",sha] : []), "-m", "Bevar faste aggregerede målepunkter"]);
    try { git(["push", "origin", `${commit}:refs/heads/${branch}`]); console.log(`Målepunktsarkiv gemt: ${merged.records.length} målinger.`); break; }
    catch (error) { if (attempt===2) throw error; }
  }
} else throw Error("Brug restore eller save.");
