/**
 * Regenerates data/catalog.js from data/catalog.json.
 * Run after manually editing the JSON catalog:
 *   node scripts/build-catalog.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const json = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const banner = `/*\n * Generated browser copy of data/catalog.json.\n * Source of truth: data/catalog.json\n * If you edit the JSON manually, run: node scripts/build-catalog.mjs\n */\n`;
await writeFile(new URL('../data/catalog.js', import.meta.url), `${banner}window.ANISHELF_CATALOG = ${JSON.stringify(json)};\n`);
console.log(`catalog.js regenerated (${json.length} entries)`);
