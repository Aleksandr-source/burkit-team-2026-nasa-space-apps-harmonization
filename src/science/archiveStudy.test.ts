import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareStudyCohort,evaluateStudy} from './archiveStudy';
import {parseFirmsCsv} from './firms';
test('archive cohort preserves source type and excludes static sources and low confidence',()=>{
 const data=parseFirmsCsv('latitude,longitude,acq_date,acq_time,frp,confidence,satellite,instrument,type\n48,67,2024-01-01,1200,10,90,Terra,MODIS,0\n48,67,2024-01-02,1200,10,90,Terra,MODIS,2\n48,67,2024-01-03,1200,10,20,Terra,MODIS,0\n48,67,2024-01-04,1200,10,n,N20,VIIRS,0','kazakhstan').observations;
 assert.equal(data[1].detectionType,2);
 const out=prepareStudyCohort([...data,data[0]]);assert.equal(out.rows.length,2);assert.equal(out.excluded.duplicates,1);assert.equal(out.excluded.nonVegetationOrUnknown,1);assert.equal(out.excluded.lowConfidence,1);
});
test('study exports independent holdout predictions with fixed training-only baselines',()=>{
 const csv=['latitude,longitude,acq_date,acq_time,frp,confidence,satellite,instrument,type'];
 for(let d=1;d<=12;d++){const date=`2024-01-${String(d).padStart(2,'0')}`;csv.push(`48,67,${date},1200,${d},90,Terra,MODIS,0`,`48,67,${date},1200,${2*d},n,N20,VIIRS,0`);}
 const report=evaluateStudy(prepareStudyCohort(parseFirmsCsv(csv.join('\n'),'kazakhstan').observations).rows);
 assert.equal(report.metrics?.calibrated.rmse,0);assert.ok(report.metrics!.identity.rmse>0);assert.equal(report.calibration?.scale,2);
 const train=report.pairs.filter(r=>r.split==='train'),testRows=report.pairs.filter(r=>r.split==='holdout');assert.ok(train.at(-1)!.date<testRows[0].date);assert.ok(testRows.every(r=>r.predicted===r.viirsFrp));assert.equal(report.scientificallyValidated,false);
 const fixed=evaluateStudy(prepareStudyCohort(parseFirmsCsv(csv.join('\n'),'kazakhstan').observations).rows,'2024-01-06');assert.equal(fixed.calibration?.trainSamples,6);assert.equal(fixed.calibration?.holdoutSamples,6);assert.equal(fixed.calibration?.trainEnd,'2024-01-06');
});
