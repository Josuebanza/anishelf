/**
 * Optional poster downloader for maintainers.
 *
 * What it does
 * ------------
 * 1. Reads data/catalog.json.
 * 2. Searches Jikan (unofficial MyAnimeList API) using each searchTitle.
 * 3. Downloads the largest available WEBP cover to assets/posters/<posterSlug>.webp.
 * 4. Never deletes the committed SVG fallback.
 *
 * Requirements: Node.js 18+ (native fetch). No npm install is needed.
 * Usage:
 *   node scripts/fetch-posters.mjs
 *
 * Notes:
 * - This is a maintenance script, NOT code executed by GitHub Pages visitors.
 * - Jikan is rate-limited, so the script deliberately waits between requests.
 * - Search APIs can occasionally pick the wrong season/title. Review the log and
 *   replace any incorrect file manually when needed.
 * - Respect the image host/API terms when publishing downloaded artwork.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('data/catalog.json', root), 'utf8'));
const posterDir = new URL('assets/posters/', root);
await mkdir(posterDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = async (url) => { try { await access(url, constants.F_OK); return true; } catch { return false; } };

let downloaded = 0, skipped = 0, failed = 0;
for (const [index, anime] of catalog.entries()) {
  const target = new URL(`${anime.posterSlug}.webp`, posterDir);
  if (await exists(target)) {
    console.log(`[${index + 1}/${catalog.length}] skip  ${anime.title}`);
    skipped++;
    continue;
  }

  try {
    const endpoint = new URL('https://api.jikan.moe/v4/anime');
    endpoint.searchParams.set('q', anime.searchTitle || anime.title);
    endpoint.searchParams.set('limit', '5');
    endpoint.searchParams.set('sfw', 'true');

    const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Jikan HTTP ${response.status}`);
    const payload = await response.json();
    const match = payload.data?.[0];
    const imageUrl = match?.images?.webp?.large_image_url || match?.images?.jpg?.large_image_url;
    if (!imageUrl) throw new Error('aucune image trouvée');

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`image HTTP ${imageResponse.status}`);
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    await writeFile(target, bytes);
    downloaded++;
    console.log(`[${index + 1}/${catalog.length}] ok    ${anime.title}  ←  ${match.title}`);
  } catch (error) {
    failed++;
    console.warn(`[${index + 1}/${catalog.length}] FAIL  ${anime.title}: ${error.message}`);
  }

  // Jikan commonly documents ~3 req/s. 650ms also leaves room for image requests.
  await sleep(650);
}

console.log(`\nDone: ${downloaded} downloaded, ${skipped} already present, ${failed} failed.`);
