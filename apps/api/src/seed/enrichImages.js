import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import Dish from '../models/Dish.js';
import { dishes as seedDishes } from './dishes.data.js';

/**
 * Attaches a real food photograph to every seeded dish.
 *
 * Images are downloaded once from Wikimedia Commons (free licence) into
 * apps/web/public/dishes and are then served by the web app itself, so the
 * product never depends on an external image CDN at runtime.
 *
 * Run:  npm run seed:images   (from apps/api)
 */

const UA = 'SwaadCartAI-Capstone/1.0 (educational capstone project)';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_PUBLIC = path.resolve(API_ROOT, '../../web/public/dishes');
const DATA_DIR = path.join(API_ROOT, 'data');
const MANIFEST = path.join(WEB_PUBLIC, 'images.manifest.json');

// Words that disqualify a photo (mushroom species, diagrams, logos, ...).
const BLOCKLIST = ['agaric', 'amanita', 'fly ', 'poison', 'toxic', 'spore', 'illustration', 'drawing', 'map', 'logo', 'stamp', 'coin', 'salmon', 'tuna', 'chart'];

// Dishes whose Wikimedia title does not contain the dish name.
const SEARCH_TERMS = {
  'Missi Poori': ['Missi Roti', 'poori'],
  'Moong Dal Chilla': ['Moong Dal Chilla', 'chilla'],
  'Kanchipuram Idli': ['Idli', 'Idli Sambar'],
  'Dal Fry': ['Dal Tadka', 'dal'],
  'Dal Khichdi': ['Khichdi', 'Spicy Khichdi'],
  'Mix Vegetable Sabzi': ['Mixed Vegetable Curry', 'sabzi'],
  'Paneer 65': ['Chilli Paneer', 'Paneer Tikka'],
  'Cheese Corn Nuggets': ['corn nugget snack', 'corn kernels'],
  'Murmura Chivda': ['Chivda', 'puffed rice'],
  'Sukhi Bhel': ['Bhel puri', 'bhel'],
  'Egg Chaat': ['Egg Chaat', 'boiled egg'],
  'Palak Mushroom': ['Palak Paneer', 'palak mushroom curry'],
  'Rajma Paneer Combo': ['Rajma Chawal', 'rajma'],
  'Mutton Keema Mattar': ['Keema', 'mutton keema'],
  'Onion Bhaji': ['Aloo Bhaji', 'bhaji'],
  'Kofta Pulao': ['Vegetable Pulao', 'pulao'],
  'Kathal Masala': ['Jackfruit Curry', 'jackfruit masala'],
  'Lemon Khichdi': ['Khichdi', 'dal khichdi'],
  'Jalebi': ['Jalebi', 'jalebi sweet'],
  'Gulab Jamun': ['Gulab jamun', 'jamun'],
  'Rasmalai': ['Rasmalai', 'rasmalai sweet']
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalize = (s) =>
  s.toLowerCase().replace(/\.(jpg|jpeg|png|gif|webp)$/i, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenSet = (s) => new Set(normalize(s).split(' ').filter((t) => t.length > 2));

function score(dish, title) {
  const d = normalize(dish);
  const t = normalize(title);
  if (d === t) return 100;
  if (t.includes(d)) return 90;
  if (d.includes(t) && t.length > 4) return 80;
  const dt = tokenSet(dish);
  const tt = tokenSet(title);
  let hits = 0;
  for (const token of dt) if (tt.has(token)) hits++;
  const ratio = hits / Math.max(dt.size, 1);
  if (ratio >= 0.99) return 85;
  if (ratio >= 0.6) return 70;
  if (ratio >= 0.34) return 50;
  return 0;
}

async function commonsSearch(term) {
  const url =
    `${COMMONS_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(term + ' filetype:bitmap')}` +
    '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900&format=json';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.status === 429 || res.status === 503) { await sleep(4000 * (attempt + 1)); continue; }
      if (!res.ok) return [];
      const json = await res.json();
      const results = [];
      for (const page of Object.values(json.query?.pages || {})) {
        const info = page.imageinfo?.[0];
        if (!info || !/image\/(jpeg|png)/.test(info.mime || '')) continue;
        const ratio = info.height ? info.width / info.height : 1;
        if (!info.width || info.width < 600 || ratio < 0.55 || ratio > 1.9) continue;
        const title = page.title.replace(/^File:/, '');
        if (BLOCKLIST.some((word) => normalize(title).includes(word))) continue;
        const src = (info.thumburl || info.url).split('?')[0];
        if (src) results.push({ title, src, score: score(term, title) });
      }
      return results.sort((a, b) => b.score - a.score);
    } catch {
      await sleep(3000 * (attempt + 1));
    }
  }
  return [];
}

async function download(src, dest) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(src, { headers: { 'User-Agent': UA } });
      if (res.status === 429 || res.status === 503) { await sleep(5000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 4000) throw new Error('image too small');
      await fs.writeFile(dest, buffer);
      return true;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(4000 * (attempt + 1));
    }
  }
  return false;
}

const slugify = (name) =>
  normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  await fs.mkdir(WEB_PUBLIC, { recursive: true });
  const manifest = await readManifest();
  const names = seedDishes.map((d) => d.name);
  const images = {};
  let downloaded = 0;
  let reused = 0;
  const missing = [];

  for (const name of names) {
    const file = slugify(name) + '.jpg';
    const dest = path.join(WEB_PUBLIC, file);
    const known = manifest[name];
    let exists = false;
    try { await fs.access(dest); exists = true; } catch { exists = false; }

    if (exists) {
      images[name] = '/dishes/' + file;
      reused++;
      if (known) continue;

      // File is already on disk but has no attribution yet: record it best-effort.
      const terms = SEARCH_TERMS[name] || [name];
      const candidates = await commonsSearch(terms[0]);
      const best = candidates.find((c) => c.score >= 50);
      if (best) manifest[name] = { file: 'dishes/' + file, title: best.title, source: best.src };
      await sleep(400);
      continue;
    }

    const terms = SEARCH_TERMS[name] || [name];
    let picked = null;
    for (const term of terms) {
      const candidates = await commonsSearch(term);
      picked = candidates.find((c) => c.score >= 50);
      if (picked) break;
      await sleep(300);
    }

    if (!picked) { missing.push(name); continue; }

    try {
      await download(picked.src, dest);
      downloaded++;
    } catch (err) {
      console.log(`  download failed for ${name}: ${err.message}`);
      missing.push(name);
      continue;
    }
    manifest[name] = { file: 'dishes/' + file, title: picked.title, source: picked.src };
    images[name] = '/dishes/' + file;
    await sleep(600);
  }

  // generic fallback used when a dish has no photo
  const fallbackFile = 'fallback.jpg';
  const fallbackPath = path.join(WEB_PUBLIC, fallbackFile);
  try { await fs.access(fallbackPath); } catch {
    const candidates = await commonsSearch('Indian thali food');
    if (candidates[0]) {
      await download(candidates[0].src, fallbackPath).catch(() => {});
      manifest['__fallback__'] = { file: 'dishes/' + fallbackFile, title: candidates[0].title, source: candidates[0].src };
    }
  }

  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const entries = Object.entries(images).map(([k, v]) => `  '${k.replace(/'/g, "\\'")}': '${v}'`).join(',\n');
  const header =
    '// Auto-generated by src/seed/enrichImages.js - do not edit by hand.\n' +
    '// Photos live in apps/web/public/dishes and are served by the web app itself,\n' +
    '// so the product works offline and never depends on an external image CDN.\n';
  await fs.writeFile(
    path.join(DATA_DIR, 'dishImages.js'),
    `${header}const dishImages = {\n${entries}\n};\n\nconst fallback = '/dishes/fallback.jpg';\n\nexport { dishImages, fallback };\n`,
    'utf8'
  );

  let updated = 0;
  try {
    await mongoose.connect(env.MONGODB_URI);
    const existing = await Dish.find({}).select('name').lean();
    const ops = Object.entries(images)
      .filter(([name]) => existing.some((d) => d.name === name))
      .map(([name, imageUrl]) => ({ updateOne: { filter: { name }, update: { $set: { imageUrl } } } }));
    if (ops.length) await Dish.bulkWrite(ops);
    updated = ops.length;
    await mongoose.disconnect();
  } catch (err) {
    console.log('  database update skipped:', err.message);
  }

  console.log(`images: ${Object.keys(images).length}/${names.length} mapped (${downloaded} downloaded, ${reused} reused), db updated: ${updated}`);
  if (missing.length) console.log('missing:', missing.join(', '));
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore disconnect errors */ }
  process.exit(1);
});
