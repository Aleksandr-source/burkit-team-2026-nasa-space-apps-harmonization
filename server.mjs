import express from 'express';
import 'dotenv/config';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const app=express(); const root=path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');next();});
app.get('/api/health',(_req,res)=>res.json({ok:true,firmsConfigured:Boolean(process.env.FIRMS_MAP_KEY)}));
const cache=new Map();let lastRequest=0;
app.get('/api/firms',async(req,res)=>{
 const key=process.env.FIRMS_MAP_KEY;if(!key)return res.status(503).json({error:'FIRMS_MAP_KEY is not configured. Import a FIRMS CSV or configure the server. Demo data was not substituted.'});
 const source=String(req.query.source??'');const days=Number(req.query.days??1);const bbox=String(req.query.bbox??'');const coords=bbox.split(',').map(Number);
 if(!['MODIS_NRT','VIIRS_SNPP_NRT','VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT'].includes(source)||!Number.isInteger(days)||days<1||days>5||coords.length!==4||coords.some(x=>!Number.isFinite(x))||coords[0]<-180||coords[2]>180||coords[1]<-90||coords[3]>90||coords[0]>=coords[2]||coords[1]>=coords[3])return res.status(400).json({error:'Invalid source, days (1–5), or west,south,east,north bounds.'});
 const id=[source,bbox,days].join('|');const old=cache.get(id);if(old&&Date.now()-old.at<300000)return res.type('text/csv').send(old.text);
 if(Date.now()-lastRequest<1200)return res.status(429).json({error:'Please wait briefly before another NASA request.'});lastRequest=Date.now();
 try{const response=await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${bbox}/${days}`,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('upstream');const text=await response.text();if(text.length>15000000) return res.status(413).json({error:'NASA response too large. Select a smaller area.'});
  if(!text.trimStart().startsWith('latitude,longitude'))return res.status(502).json({error:'NASA returned an error or an unexpected format. Check the key and availability.'});
  if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(id,{at:Date.now(),text});res.type('text/csv').send(text);
 }catch{res.status(502).json({error:'NASA FIRMS request failed or timed out. No demo fallback.'});}
});
app.get('/api/search',async(req,res)=>{
 const q=String(req.query.q??'').trim();if(q.length<2||q.length>150)return res.status(400).json({error:'Enter 2–150 characters.'});
 try{const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:q,count:'6',language:req.query.lang==='ru'?'ru':'en',format:'json'}).toString();
  const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const data=await r.json();res.json({results:(data.results??[]).map(p=>({name:[p.name,p.admin1,p.country].filter(Boolean).join(', '),lat:p.latitude,lng:p.longitude})),attribution:'Open-Meteo / GeoNames'});
 }catch{res.status(502).json({error:'Global place search is unavailable; use coordinates or the offline country list.'});}
});
app.use(express.static(path.join(root,'dist')));app.get('*',(_req,res)=>res.sendFile(path.join(root,'dist/index.html')));
app.listen(Number(process.env.PORT??3001),'127.0.0.1',()=>console.log('FireLens http://127.0.0.1:'+ (process.env.PORT??3001)));
