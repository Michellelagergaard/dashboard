import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordCheckpoints } from "../config/decision-methods.mjs";

test("checkpoint storage survives a missing cache, retains older points and never writes main",()=>{
  const directory=mkdtempSync(join(tmpdir(),"dp-checkpoint-test-"));
  const repo=join(directory,"work"),remote=join(directory,"origin.git");
  const run=(command,args)=>execFileSync(command,args,{cwd:repo,encoding:"utf8",stdio:["pipe","pipe","pipe"]});
  try {
    mkdirSync(repo);run("git",["init","--bare",remote]);run("git",["init"]);run("git",["remote","add","origin",remote]);
    for(const folder of ["scripts","config"])mkdirSync(join(repo,folder));
    for(const file of ["scripts/checkpoint-storage.mjs","config/decision-methods.mjs"])copyFileSync(new URL(`../${file}`,import.meta.url),join(repo,file));
    run(process.execPath,["scripts/checkpoint-storage.mjs","restore"]);
    const path=join(repo,".cache","measurement-checkpoints.json");
    assert.deepEqual(JSON.parse(readFileSync(path)),{version:1,records:[]});
    const issue={id:"test",sentAt:"2026-10-01T10:00:00Z",fetchedAt:"2026-10-02T10:17:00Z",delivered:100,openRate:50,clickRate:10,unsubscribes:0,measurementVersion:2};
    const original=recordCheckpoints({version:1,records:[]},issue);
    writeFileSync(path,JSON.stringify(original));run(process.execPath,["scripts/checkpoint-storage.mjs","save"]);
    const incoming=recordCheckpoints({version:1,records:[]},{...issue,clickRate:99});incoming.records.push({...original.records[0],mailingId:"second"});
    writeFileSync(path,JSON.stringify(incoming));run(process.execPath,["scripts/checkpoint-storage.mjs","save"]);
    rmSync(path);run(process.execPath,["scripts/checkpoint-storage.mjs","restore"]);
    const restored=JSON.parse(readFileSync(path));assert.equal(restored.records.length,2);assert.equal(restored.records[0].clickRate,10);
    assert.equal(run("git",["ls-remote","--heads","origin","refs/heads/main"]),"");
    const branches=run("git",["ls-remote","--heads","origin"]);assert.match(branches,/refs\/heads\/data\/measurement-checkpoints/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
