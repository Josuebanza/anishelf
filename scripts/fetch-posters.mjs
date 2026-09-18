#!/usr/bin/env node
/**
 * Download real posters from AniList into assets/posters/.
 *
 * Usage:
 *   node scripts/fetch-posters.mjs
 *   node scripts/fetch-posters.mjs --force
 *
 * No npm package is required (Node 18+). The script keeps each generated SVG as
 * a permanent fallback and writes the downloaded cover next to it as .jpg/.png.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'data/catalog.json'),'utf8'));
const force=process.argv.includes('--force');
const out=path.join(root,'assets/posters');

async function existing(id){
  for(const ext of ['webp','jpg','jpeg','png']) try{await fs.access(path.join(out,`${id}.${ext}`));return true}catch{}
  return false;
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function lookupBatch(batch){
  const variables={}, defs=[], fields=[];
  batch.forEach((a,i)=>{variables[`s${i}`]=a.searchTitle||a.title;defs.push(`$s${i}: String`);fields.push(`m${i}: Media(search:$s${i}, type:ANIME, sort:POPULARITY_DESC){ id title{romaji english} coverImage{extraLarge large} }`)});
  const query=`query(${defs.join(',')}){${fields.join('\n')}}`;
  const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables})});
  if(!r.ok)throw new Error(`AniList HTTP ${r.status}`);
  const json=await r.json(); return batch.map((a,i)=>({anime:a,media:json?.data?.[`m${i}`]}));
}
async function download({anime,media}){
  const url=media?.coverImage?.extraLarge||media?.coverImage?.large; if(!url){console.log('MISS',anime.title);return;}
  const r=await fetch(url); if(!r.ok){console.log('IMG FAIL',anime.title,r.status);return;}
  const type=r.headers.get('content-type')||''; const ext=type.includes('png')?'png':type.includes('webp')?'webp':'jpg';
  const buf=Buffer.from(await r.arrayBuffer()); await fs.writeFile(path.join(out,`${anime.id}.${ext}`),buf);
  console.log('OK ',anime.title,'→',media?.title?.english||media?.title?.romaji||'?',`(${anime.id}.${ext})`);
}
const todo=[]; for(const a of catalog) if(force||!(await existing(a.id))) todo.push(a);
console.log(`${todo.length} poster(s) à récupérer.`);
for(let i=0;i<todo.length;i+=10){ const batch=todo.slice(i,i+10); try{const found=await lookupBatch(batch);for(const item of found)await download(item);}catch(e){console.error('Batch failed:',e.message);} await sleep(900); }
console.log('Terminé. Les SVG fallback ont été conservés.');
