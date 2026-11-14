import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {HotspotObservation} from '../types/firelens';
import {matchOverpasses,fitOverpassModel,evaluateOverpassModel} from './overpass';
function obs(id:string,sensor:'MODIS'|'VIIRS',date:string,time:string,lat:number,lng:number,frpMw:number):HotspotObservation {return {id,sensor,satellite:sensor==='MODIS'?'Aqua':'N20',date,acqTimeUtc:time,lat,lng,frpMw,regionId:'kazakhstan',year:Number(date.slice(0,4)),month:1,week:1,frpUnit:'MW',modisConfidencePct:sensor==='MODIS'?90:null,viirsConfidenceLevel:sensor==='VIIRS'?'nominal':null,intensity:.1,dataStatus:'real',dayNight:'N',detectionType:0};}
test('overpasses match across midnight, sum VIIRS once, enforce actual time/distance and satellite',()=>{
 const rows=[obs('a','MODIS','2024-01-01','23:50',48,67,10),obs('v1','VIIRS','2024-01-02','00:05',48,67,5),obs('v2','VIIRS','2024-01-02','00:06',48.001,67,7),obs('far','VIIRS','2024-01-02','00:05',49,67,500),obs('late','VIIRS','2024-01-02','02:05',48,67,500),{...obs('terra','MODIS','2024-01-01','23:50',50,67,99),satellite:'Terra'}];
 const r=matchOverpasses(rows,{radiusKm:2,maxMinutes:60});assert.equal(r.groups.length,1);assert.equal(r.groups[0].viirsFrp,12);assert.equal(r.assignments.length,2);assert.equal(r.groups[0].maxMinutes,16);assert.equal(r.aquaRecords,1);
});
test('each VIIRS goes to nearest Aqua and tie resolution is order independent',()=>{
 const a=obs('a','MODIS','2024-01-01','12:00',48,67,10),b=obs('b','MODIS','2024-01-01','12:01',48,67.02,10),v=obs('v','VIIRS','2024-01-01','12:00',48,67.019,5);
 const r=matchOverpasses([a,b,v],{radiusKm:2,maxMinutes:60});assert.equal(r.assignments[0].aquaId,'b');assert.equal(r.groups[0].viirsFrp,5);
 assert.deepEqual(matchOverpasses([v,b,a],{radiusKm:2,maxMinutes:60}).groups,r.groups);
});
test('frozen 2024 coefficient is applied to 2025 without refitting',()=>{
 const train=Array.from({length:20},(_,i)=>({aquaFrp:i+1,viirsFrp:2*(i+1)}));const model=fitOverpassModel(train);assert.equal(model?.scale,2);
 const testRows=[{aquaFrp:10,viirsFrp:100},{aquaFrp:20,viirsFrp:200}];const result=evaluateOverpassModel(testRows,model!);assert.deepEqual(result.predictions,[20,40]);assert.equal(model?.scale,2);assert.ok(result.calibrated.rmse!>0);assert.equal(fitOverpassModel(train.slice(0,2)),null);
});
