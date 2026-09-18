#!/usr/bin/env node
/** Regenerate data/catalog.js after editing data/catalog.json. */
import fs from 'node:fs/promises';
const data=JSON.parse(await fs.readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../data/catalog.js',import.meta.url),'// Generated from catalog.json.\nwindow.ANISHELF_CATALOG = '+JSON.stringify(data,null,2)+';\n');
console.log(`catalog.js regenerated (${data.length} anime).`);
