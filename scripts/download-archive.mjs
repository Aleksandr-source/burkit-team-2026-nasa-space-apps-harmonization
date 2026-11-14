/** Run with node --env-file=.env scripts/download-archive.mjs from a working directory. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const key=process.env.FIRMS_MAP_KEY;if(!key)throw Error('Set FIRMS_MAP_KEY on the server or use node --env-file=.env');
const year=Number(process.env.FIRELENS_ARCHIVE_YEAR??2024);if(!Number.isInteger(year)||year<2018||year>2025)throw Error('Archive year must be 2018–2025');
const directory=path.resolve(process.env.FIRELENS_ARCHIVE_DIR??`work/archive-${year}`);fs.mkdirSync(directory,{recursive:true});
const sources=['MODIS_SP','VIIRS_NOAA20_SP'];const start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1),day=86400000;
const expectedChunks=Math.ceil((end-start)/day/5);
const manifest={year,bbox:[46.5,40.5,87.3,55.5],products:sources,downloadedAt:new Date().toISOString(),chunks:[]};
await Promise.all(sources.map(async source=>{
 let completed=0;
 for(let time=start;time<end;time+=5*day){const date=new Date(time).toISOString().slice(0,10),days=Math.min(5,Math.round((end-time)/day));const filename=`${source}_${date}_${days}d.csv`;const file=path.join(directory,filename);let text;
  if(fs.existsSync(file)){text=fs.readFileSync(file,'utf8');}else{
   let success=false;
   for(let attempt=0;attempt<3;attempt++){try{
    const response=await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/46.5,40.5,87.3,55.5/${days}/${date}`,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('upstream status '+response.status);text=await response.text();
    if(!text.trimStart().startsWith('latitude,longitude,'))throw Error('Unexpected NASA format');
    fs.writeFileSync(file,text);success=true;break;
   }catch{if(attempt<2)await new Promise(r=>setTimeout(r,2500*(attempt+1)));}}
   if(!success)throw Error(`NASA download failed for ${source} ${date}. Resume the same command to reuse completed chunks.`);
  }
  if(!text.trimStart().startsWith('latitude,longitude,'))throw Error('Invalid cached CSV: '+filename);
  manifest.chunks.push({source,date,days,file:filename,rows:Math.max(0,text.trim().split('\n').length-1),sha256:createHash('sha256').update(text).digest('hex')});
  completed++;if(completed%10===0||time+5*day>=end)console.log(`${source}: ${completed}/${expectedChunks} chunks, through ${date}`);
  await new Promise(r=>setTimeout(r,300));
 }
}));
manifest.chunks.sort((a,b)=>a.source.localeCompare(b.source)||a.date.localeCompare(b.date));
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
console.log('DOWNLOAD_COMPLETE',JSON.stringify({chunks:manifest.chunks.length,records:manifest.chunks.reduce((s,c)=>s+c.rows,0),directory}));
