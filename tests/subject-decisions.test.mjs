import test from 'node:test';
import assert from 'node:assert/strict';
import {sentSubject,storiesNamedInSubject,subjectDecisionEvidence} from '../config/subject-decisions.mjs';
const asOf='2026-11-03T12:00:00Z';
const headline='Regionernes udbud efterlader huller i tilbuddet til unge';
const story=(title=headline,destination='https://www.dp.dk/nyheder/udbud',clicks=20)=>({title,destination,clicks,editorial:{kind:'news',title},clickMeasurement:{metric:'unique-contacts',aggregation:'single-link'}});
const issue=(n,extra={})=>({id:'issue-'+n,type:'Psykologernes Nyhedsbrev',date:`${n}. okt. 2026`,sentAt:`2026-10-0${n}T12:00:00Z`,subject:'Fælles emnefelt som ikke må bruges som variant',delivered:100,openRate:50,clickRate:10,content:[story(),story('Forskertalk: Hvad ved vi om effekten af psykoterapi?','https://dp.dk/forskertalk',999)],segmentSubjects:[{audience:'Selvstændige',subject:headline},{audience:'Ledige',subject:'Et andet emnefelt til en anden målgruppe'}],segmentPerformance:[{name:'Selvstændige',recipients:100,openRate:50,clickRate:10}],segmentLinkPerformance:[],...extra});

test('uses the actual audience subject and never substitutes aggregate or another audience',()=>{
 const row=issue(1);assert.equal(sentSubject(row,'Selvstændige'),headline);assert.equal(sentSubject(row,'Ledere'),null);assert.equal(sentSubject(row),null);
 assert.equal(sentSubject({...row,segmentSubjects:[...row.segmentSubjects,{audience:'Selvstændige',subject:'Modstridende variant'}]},'Selvstændige'),null);
 assert.equal(sentSubject({...row,type:'TR/AMR Nyt',segmentSubjects:[],subject:'Emnefelt mangler'}),null);
 assert.equal(sentSubject({...row,type:'TR/AMR Nyt',segmentSubjects:[],subject:'TR/AMR: En faktisk sendt overskrift'}),'TR/AMR: En faktisk sendt overskrift');
});

test('a click winner outside the subject is never treated as its story',()=>{
 const row=issue(1);const matched=storiesNamedInSubject(row,headline);
 assert.deepEqual(matched.map(s=>s.title),[headline]);assert.equal(matched[0].clicks,20);
 assert.deepEqual(storiesNamedInSubject(row,'En overskrift, der ikke matcher et gemt link'),[]);
});

test('course and magazine links only appear when their own full headline is actually in the subject',()=>{
 const course=story('Få indblik i ICD-11 og PTSD på dette kursus','https://www.dp.dk/course/ptsd-123');
 const magazine=story('Psilocybin og psykiske lidelser: Hvad ved vi?','https://dp.dk/p-psykologernes-fagmagasin/artikler/psilocybin');
 const row=issue(1,{content:[story(),course,magazine]});
 assert.deepEqual(storiesNamedInSubject(row,headline).map(s=>s.kind),['Historie']);
 assert.deepEqual(storiesNamedInSubject(row,course.title+' | '+magazine.title).map(s=>s.kind),['Kursus','P-artikel']);
});

test('ambiguous titles, unsafe destinations and missing audience measurements cannot become exact counts',()=>{
 const row=issue(1);row.content.push(story(headline,'https://dp.dk/another-destination'));
 assert.deepEqual(storiesNamedInSubject(row,headline),[]);
 assert.deepEqual(storiesNamedInSubject(issue(1,{content:[story(headline,'javascript:alert(1)')]}),headline),[]);
 const catalog={destination:story().destination,title:headline,audienceScope:'all'};
 const segment=issue(1,{editorialCatalog:[catalog]});
 assert.equal(storiesNamedInSubject(segment,headline,'Selvstændige')[0].clicks,null);
 segment.segmentLinkPerformance=[{...story(headline,story().destination,0),audience:'Selvstændige'}];
 assert.equal(storiesNamedInSubject(segment,headline,'Selvstændige')[0].clicks,0);
 segment.segmentLinkPerformance.push({...segment.segmentLinkPerformance[0]});
 assert.equal(storiesNamedInSubject(segment,headline,'Selvstændige')[0].clicks,null);
});

test('references and rate baselines exclude other newsletters, later issues and duplicate sends',()=>{
 const selected=issue(4);const rows=[issue(1),issue(1),issue(2),issue(3),selected,issue(5),issue(2,{id:'course',type:'Kompetencenyt',clickRate:90}),issue(3,{id:'magazine',type:'Magasinet P',clickRate:90})];
 const before=JSON.stringify(rows);const result=subjectDecisionEvidence(rows,{selected,audience:'Selvstændige',asOf});
 assert.equal(result.total,4);assert.equal(result.references.length,4);assert.equal(result.references[0].click.count,3);assert.equal(result.references[0].click.baseline,10);assert.equal(JSON.stringify(rows),before);
 assert.equal(subjectDecisionEvidence(rows,{selected,asOf}).audienceRequired,true);
 assert.equal(subjectDecisionEvidence(rows,{selected,audience:'Ledere',asOf}).references.length,0);
});

test('young issues remain provisional while older subject references are retained',()=>{
 const young=issue(4,{sentAt:'2026-11-02T12:00:00Z'});const rows=[issue(1),issue(2),issue(3),young];
 const result=subjectDecisionEvidence(rows,{selected:young,audience:'Selvstændige',asOf});
 assert.equal(result.references[0].click.mature,false);assert.equal(result.references[0].click.delta,null);assert.equal(result.references[1].click.mature,true);
});
