#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
const c=JSON.parse(await fs.readFile(path.join(root,'data/catalog.json'),'utf8'));
let ok=true;const ids=new Set();for(const a of c){if(ids.has(a.id)){console.error('Duplicate id',a.id);ok=false}ids.add(a.id);try{await fs.access(path.join(root,'assets/posters',a.id+'.svg'))}catch{console.error('Missing fallback',a.id);ok=false}}
for(const f of ['index.html','css/styles.css','js/app.js','data/catalog.js','manifest.webmanifest','sw.js'])try{await fs.access(path.join(root,f))}catch{console.error('Missing',f);ok=false}
console.log(`${c.length} anime · ${ok?'audit OK':'audit FAILED'}`);process.exit(ok?0:1);
