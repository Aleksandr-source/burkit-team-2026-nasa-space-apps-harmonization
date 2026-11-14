import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {HotspotObservation} from '../types/firelens';
import {calendarPeriods,buildActivityCalendar,calendarEvidenceIds,sameActivityCalendar} from './calendar';
import {createInitialFireLensState,fireLensReducer} from '../state/FireLensContext';
import {loadDemoDataset} from '../data/adapters/pythonJsonAdapter';
function record(id:string,date:string,sensor:'MODIS'|'VIIRS',frpMw=10):HotspotObservation{return {id,date,sensor,frpMw,year:Number(date.slice(0,4)),month:Number(date.slice(5,7)),week:1,regionId:'kazakhstan',lat:48,lng:67,acqTimeUtc:'12:00',frpUnit:'MW',modisConfidencePct:sensor==='MODIS'?90:null,viirsConfidenceLevel:sensor==='VIIRS'?'nominal':null,dayNight:'D',detectionType:0,intensity:0,dataStatus:'real',satellite:sensor==='MODIS'?'Aqua':'N20'};}
test('calendar seven-day periods retain leap and normal year tails exactly once',()=>{
 for(const year of [2024,2025]){const p=calendarPeriods(year,'week');assert.equal(p.length,53);assert.equal(p.at(-1)?.end,`${year}-12-31`);assert.equal(p.reduce((s,r)=>s+r.days,0),year===2024?366:365);assert.equal(p.at(-1)?.days,year===2024?2:1);for(let i=1;i<p.length;i++)assert.equal(Date.parse(p[i].start)-Date.parse(p[i-1].end),86400000);}
 assert.equal(calendarPeriods(2024,'month')[1].days,29);
});
test('raw series stay separate and zero FRP is retained while absent observations stay null',()=>{
 const rows=[record('a','2024-01-01','MODIS',0),record('v','2024-01-07','VIIRS',20),record('tail','2024-12-31','MODIS',5)];
 const c=buildActivityCalendar(rows,[],{years:[2024],scale:.5,coverage:{2024:{MODIS:['2024-01-01'],VIIRS:['2024-01-07']}}});
 const jan=c.months[0];assert.equal(jan.aqua.count,1);assert.equal(jan.aqua.frpSum,0);assert.equal(jan.viirs.count,1);assert.equal(jan.viirs.frpSum,20);assert.equal(jan.queryDays.MODIS,1);assert.equal(jan.queryComplete,false);
 assert.equal(c.months[1].aqua.count,0);assert.equal(c.months[1].aqua.frpSum,null);assert.equal(c.months[1].matched.aquaFrp,null);assert.equal(c.weeks[52].aqua.count,1);assert.equal(c.weeks.reduce((s,p)=>s+p.aqua.count,0),2);
});
test('matched calendar uses paired groups only and frozen scale, never raw sensor totals',()=>{
 const rows=[record('a','2025-02-03','MODIS',10),{...record('unmatched','2025-02-03','MODIS',999),lat:49},record('v','2025-02-03','VIIRS',20)];
 const groups=[{aquaId:'a',date:'2025-02-03',time:'12:00',lat:48,lng:67,aquaFrp:10,viirsFrp:20,viirsCount:1,maxKm:1,maxMinutes:10}];
 const c=buildActivityCalendar(rows,groups,{years:[2025],scale:.4,coverage:{}}),feb=c.months[1];assert.equal(feb.aqua.frpSum,1009);assert.equal(feb.matched.groups,1);assert.equal(feb.matched.aquaFrp,10);assert.equal(feb.matched.scaledAquaFrp,4);assert.equal(feb.matched.viirsFrp,20);assert.equal(c.baselineAvailable,false);assert.equal(c.forecastAvailable,false);
});
test('map evidence includes assigned VIIRS across a weekly boundary, but raw selection uses sensor dates',()=>{
 const rows=[record('a','2024-01-07','MODIS'),record('v','2024-01-08','VIIRS')],links=[{date:'2024-01-07',aquaId:'a',viirsIds:['v']}];
 assert.deepEqual(calendarEvidenceIds(rows,links,{start:'2024-01-01',end:'2024-01-07',mode:'matched',series:'scaled'}),['a','v']);
 assert.deepEqual(calendarEvidenceIds(rows,links,{start:'2024-01-01',end:'2024-01-07',mode:'raw',series:'viirs'}),[]);
});
test('calendar detects export mismatch and rejects double counted inputs',()=>{
 const r=record('a','2024-01-01','MODIS');assert.throws(()=>buildActivityCalendar([r,r],[],{years:[2024],scale:1,coverage:{}}));const c=buildActivityCalendar([r],[],{years:[2024],scale:1,coverage:{}}),copy=structuredClone(c);assert.equal(sameActivityCalendar(c,copy),true);copy.months[0].aqua.count++;assert.equal(sameActivityCalendar(c,copy),false);
});
test('loading another dataset clears real calendar and map subset scope',()=>{
 const dataset=loadDemoDataset(),calendar=buildActivityCalendar([],[],{years:[2024],scale:1,coverage:{}});let state=fireLensReducer(createInitialFireLensState(),{type:'LOAD_ACTIVITY_CALENDAR',dataset,calendar,matches:[]});assert.equal(state.activeTab,'history');assert.ok(state.activityCalendar);state={...state,calendarMapRecordIds:['x'],calendarMapSelection:{start:'2024-01-01',end:'2024-01-07',mode:'matched'}};state=fireLensReducer(state,{type:'LOAD_DATASET_SUCCESS',dataset});assert.equal(state.activityCalendar,undefined);assert.equal(state.calendarMapRecordIds,undefined);
});
