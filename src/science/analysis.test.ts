import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeObservations} from './analysis';
import {parseFirmsCsv} from './firms';
import {countryBounds,geometryBounds} from '../map/realGeoBoundaries';
import {buildPythonJsonTemplate,parseAndValidateFireLensJson} from '../data/adapters/pythonJsonAdapter';
test('country navigation uses actual bounds; invalid uploaded coordinates are rejected',()=>{
 const b=countryBounds('398');assert.ok(b.west>40&&b.east<90&&b.south>35&&b.north<60);
 assert.throws(()=>geometryBounds({type:'Polygon',coordinates:[[[999,0],[1,1],[2,2],[999,0]]]}));
});
test('an imported verified flag is not scientific evidence',()=>{
 const template=JSON.parse(buildPythonJsonTemplate());
 template.dataByRegion.kazakhstan.harmonization={verified:true,validation:{mae:0}};
 const result=parseAndValidateFireLensJson(JSON.stringify(template));assert.ok(result.ok);
 if(result.ok)assert.equal(result.dataset.dataByRegion.kazakhstan.harmonization?.verified,false);
});
test('FIRMS rejects malformed rows, preserves native confidence and midnight UTC',()=>{
 const csv='latitude,longitude,acq_date,acq_time,frp,confidence,satellite\n48,67,2024-01-01,0,10,90,Terra\n48,67,2024-01-02,0130,5,n,N\n999,67,2024-01-01,1200,3,80,Terra';
 const r=parseFirmsCsv(csv,'kz'); assert.equal(r.observations.length,2);assert.equal(r.rejected,1);
 assert.equal(r.observations[0].acqTimeUtc,'00:00');assert.equal(r.observations[1].viirsConfidenceLevel,'nominal');
});
test('duplicates removed and inadequate overlap yields no fit',()=>{
 const r=parseFirmsCsv('latitude,longitude,acq_date,acq_time,frp,confidence,satellite\n48,67,2024-01-01,0,10,90,Terra','kz').observations;
 const a=analyzeObservations([...r,...r]);assert.equal(a.uniqueRecords,1);assert.equal(a.duplicates,1);assert.equal(a.calibration,null);
});
test('chronological holdout stays independent and recovers a known scale on synthetic data',()=>{
 const lines=['latitude,longitude,acq_date,acq_time,frp,confidence,satellite'];
 for(let day=1;day<=12;day++) { const date=`2024-01-${String(day).padStart(2,'0')}`; lines.push(`48,67,${date},1200,${day},90,Terra`);lines.push(`48,67,${date},1200,${day*2},n,N`); }
 const a=analyzeObservations(parseFirmsCsv(lines.join('\n'),'kz').observations);
 assert.ok(a.calibration);assert.equal(a.calibration.scale,2);assert.equal(a.calibration.rmse,0);assert.ok(a.calibration.trainEnd<a.calibration.holdoutStart);assert.equal(a.scientificallyValidated,false);
});
