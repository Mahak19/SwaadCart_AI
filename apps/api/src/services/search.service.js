import { fuzzyMatch } from '../utils/fuzzyMatch.js';
import Ingredient from '../models/Ingredient.js';
import Dish from '../models/Dish.js';
import { chatJSON, aiEnabled } from './ai.service.js';

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

const CATALOGUE_TTL = 5 * 60 * 1000;
let catalogue = { at: 0, ings: [], dishes: [] };

async function loadCatalogue() {
  if (catalogue.ings.length && Date.now() - catalogue.at < CATALOGUE_TTL) return catalogue;
  const [ings, dishes] = await Promise.all([Ingredient.find().lean(), Dish.find().lean()]);
  catalogue = { at: Date.now(), ings, dishes };
  return catalogue;
}

export async function searchLocal(q, limit = 6) {
  const term = (q || '').trim().toLowerCase();
  if (!term) return { ingredients: [], dishes: [] };
  const { ings, dishes } = await loadCatalogue();

  const ingredients = ings
    .map(ing => {
      const names = [ing.name, ing.nameHi, ...(ing.aliases || [])].filter(Boolean);
      const score = Math.max(...names.map(n => fuzzyMatch(term, n.toLowerCase())));
      return { ing, score };
    })
    .filter(r => r.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({
      type: 'ingredient',
      source: 'local',
      name: r.ing.name,
      nameHi: r.ing.nameHi,
      category: r.ing.category,
      unit: r.ing.baseUnit,
      avgPriceINR: r.ing.avgPricePerBaseUnitINR,
      isStaple: r.ing.isStaple,
      score: Number(r.score.toFixed(2))
    }));

  const dishResults = dishes
    .map(dish => {
      const names = [dish.name, dish.nameHi, ...(dish.tags || [])].filter(Boolean);
      const score = Math.max(...names.map(n => fuzzyMatch(term, n.toLowerCase())));
      return { dish, score };
    })
    .filter(r => r.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({
      type: 'dish',
      source: 'local',
      name: r.dish.name,
      nameHi: r.dish.nameHi,
      cuisine: r.dish.cuisine,
      diet: r.dish.diet,
      slots: r.dish.slots,
      imageUrl: r.dish.imageUrl || null,
      prepMinutes: r.dish.prepMinutes,
      estimatedCostPerServingINR: r.dish.estimatedCostPerServingINR,
      score: Number(r.score.toFixed(2))
    }));

  return { ingredients, dishes: dishResults };
}

export async function searchExternal(q, limit = 5) {
  const term = (q || '').trim();
  if (!term) return [];
  const { signal, done } = withTimeout(4000);
  try {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
      encodeURIComponent(term) +
      '&search_simple=1&action=process&json=1&page_size=' + limit +
      '&fields=product_name,brands,nutriscore_grade,quantity,image_small_url';
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('off ' + res.status);
    const json = await res.json();
    return (json.products || [])
      .filter(p => p.product_name)
      .slice(0, limit)
      .map(p => ({
        type: 'external-product',
        source: 'open-food-facts',
        name: p.product_name,
        brand: p.brands || null,
        quantity: p.quantity || null,
        nutriScore: p.nutriscore_grade || null,
        image: p.image_small_url || null,
        url: p.code ? 'https://world.openfoodfacts.org/product/' + p.code : null
      }));
  } catch {
    return [];
  } finally {
    done();
  }
}

export async function searchAI(q) {
  return chatJSON([
    {
      role: 'system',
      content: 'You are SwaadCart AI, an Indian kitchen assistant. Reply ONLY with JSON: {"answer":"2-3 sentence helpful answer in the user language (Hinglish ok)","suggestions":[{"name":"dish or ingredient","qty":"approx for 2 people"}]}. Max 5 suggestions. Indian food context.'
    },
    { role: 'user', content: q }
  ], { perModelTimeoutMs: 6000, totalTimeoutMs: 9000 });
}

const SEARCH_TTL = 10 * 60 * 1000;
const SEARCH_MAX = 300;
const searchCache = new Map();
const aiCache = new Map();

function remember(cache, key, value) {
  cache.set(key, { at: Date.now(), ...value });
  if (cache.size > SEARCH_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

// The UI fetches the AI card separately so typing feels instant even when the
// model is slow or the provider is having a bad day.
export async function searchAIAnswer(q) {
  const key = String(q || '').trim().toLowerCase();
  const hit = aiCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.ai;
  const ai = await searchAI(q);
  if (ai) remember(aiCache, key, { ai });
  return ai;
}

export async function hybridSearch(q, { withAi = true } = {}) {
  const key = (withAi ? '1|' : '0|') + String(q || '').trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;

  const [local, external, ai] = await Promise.all([
    searchLocal(q),
    searchExternal(q),
    withAi ? searchAIAnswer(q) : Promise.resolve(null)
  ]);
  const data = {
    query: q,
    local,
    external,
    ai,
    aiEnabled: aiEnabled()
  };
  remember(searchCache, key, { data });
  return data;
}

