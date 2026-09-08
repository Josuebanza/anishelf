/**
 * Tiny dependency-free project audit used before deployment.
 */
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('data/catalog.json', root), 'utf8'));
const required = ['index.html','css/styles.css','js/app.js','data/catalog.js','manifest.webmanifest'];
for (const file of required) await access(new URL(file, root), constants.F_OK);
for (const anime of catalog) await access(new URL(`assets/posters/${anime.posterSlug}.svg`, root), constants.F_OK);
console.log(`Audit OK: ${catalog.length} catalog entries and ${catalog.length} fallback posters.`);
