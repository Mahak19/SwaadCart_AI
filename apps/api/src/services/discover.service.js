import { env } from '../config/env.js';
import { dishImages } from '../data/dishImages.js';
import { chatJSON, aiEnabled } from './ai.service.js';
import { hardFilterDish, memberAllergies } from './mealmind/scorer.js';
import Dish from '../models/Dish.js';
import Ingredient from '../models/Ingredient.js';
import TasteProfile from '../models/TasteProfile.js';

function withTimeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

function yt(q) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent((q || 'recipe') + ' recipe');
}

const MOODS = ['regional', 'street', 'festival', 'quick', 'international'];
const STREET_RE = /chaat|samosa|pakora|pakoda|bhaji|vada|bhel|pani puri|jalebi|kulfi|lassi|momos|tikki|golgappa|pav bhaji|misal|dabeli|puri/i;
const FESTIVAL_RE = /festival|diwali|holi|christmas|eid|puja|pongal|onam|navratri|ganpati|dussehra|celebration|wedding|mehndi|kheer|halwa|payasam|biryani|pulao|laddu|barfi/i;
const NONVEG_RE = /chicken|beef|pork|fish|prawn|lamb|shrimp|mutton|meat|kheema|keema/i;
const EGG_RE = /\begg\b|omelette|akuri|bhurji/i;
const JAIN_RE = /onion|garlic|potato|aloo|carrot|beetroot|radish|mushroom|turnip|leek|spring onion|ginger/i;
const SATTVIC_RE = /onion|garlic|leek|spring onion|scallion/i;
const VEGAN_RE = /egg|honey|paneer|curd|ghee|milk|butter|cheese|buttermilk|mayonnaise|yogurt|cream|khoya|mawa|condensed milk/i;

const INDIAN_CUISINES = new Set([
  'indian', 'north-indian', 'south-indian', 'punjabi', 'bengali', 'gujarati', 'maharashtrian',
  'kerala', 'karnataka', 'kashmiri', 'goan', 'parsii', 'mughlai', 'coastal', 'tibetan'
]);
const INTERNATIONAL_CUISINES = new Set(['chinese', 'continental', 'italian', 'mexican', 'middle-eastern']);

const STATE_CUISINES = {
  'punjab': ['punjabi', 'north-indian'],
  'delhi': ['north-indian', 'mughlai', 'punjabi'],
  'rajasthan': ['north-indian'],
  'gujarat': ['gujarati'],
  'maharashtra': ['maharashtrian', 'coastal'],
  'west bengal': ['bengali'],
  'kerala': ['kerala', 'coastal'],
  'tamil nadu': ['south-indian', 'coastal'],
  'karnataka': ['karnataka', 'south-indian'],
  'andhra pradesh': ['south-indian', 'coastal'],
  'telangana': ['south-indian', 'mughlai'],
  'bihar': ['north-indian'],
  'uttar pradesh': ['north-indian', 'mughlai'],
  'madhya pradesh': ['north-indian'],
  'assam': ['bengali'],
  'odisha': ['bengali'],
  'himachal pradesh': ['north-indian'],
  'sikkim': ['tibetan'],
  'jammu & kashmir': ['kashmiri']
};

const CATALOGUE_TTL = 5 * 60 * 1000;
let catalogueCache = { at: 0, dishes: [], ingredients: new Map() };

async function loadCatalogue() {
  if (catalogueCache.dishes.length && Date.now() - catalogueCache.at < CATALOGUE_TTL) return catalogueCache;
  const [dishes, ings] = await Promise.all([Dish.find().lean(), Ingredient.find().lean()]);
  catalogueCache = {
    at: Date.now(),
    dishes,
    ingredients: new Map(ings.map(i => [String(i._id), i]))
  };
  return catalogueCache;
}

function dietSignature(household) {
  const diets = new Set(((household && household.members) || []).map(m => m.diet).filter(Boolean));
  if (!diets.size) return 'veg';
  if (diets.has('jain')) return 'jain';
  if (diets.has('sattvic')) return 'sattvic';
  if (diets.has('vegan')) return 'vegan';
  if (diets.has('veg')) return 'veg';
  if (diets.has('eggetarian')) return 'eggetarian';
  return 'nonveg';
}

function numWeight(map, key) {
  if (!map || !key) return 0;
  const v = typeof map.get === 'function' ? map.get(key) : map[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isIndian(cuisine, region) {
  const c = String(cuisine || '').toLowerCase();
  const r = String(region || '').toLowerCase();
  if (/india|indian|pakistan|bangladesh|nepal|sri lanka/.test(r)) return true;
  if (INDIAN_CUISINES.has(c)) return true;
  if (INTERNATIONAL_CUISINES.has(c)) return false;
  return c === '' || c === 'international';
}

function moodOf(dish) {
  const hay = dish.name + ' ' + (dish.tags || []).join(' ');
  if (FESTIVAL_RE.test(hay)) return 'festival';
  if (STREET_RE.test(hay)) return 'street';
  if (!isIndian(dish.cuisine, dish.region)) return 'international';
  return 'regional';
}

function matchesMood(dish, mood) {
  if (!mood || mood === 'all') return true;
  if (mood === 'quick') return Number(dish.prepMinutes) > 0 && Number(dish.prepMinutes) <= 25;
  if (mood === 'street') return STREET_RE.test(dish.name + ' ' + (dish.tags || []).join(' '));
  if (mood === 'festival') return FESTIVAL_RE.test(dish.name + ' ' + (dish.tags || []).join(' '));
  if (mood === 'international') return !isIndian(dish.cuisine, dish.region);
  if (mood === 'regional') return isIndian(dish.cuisine, dish.region);
  return dish.mood === mood;
}

function matchesState(dish, state) {
  if (!state || state === 'All') return true;
  const key = String(state).toLowerCase().replace(/&/g, 'and');
  const hay = (dish.region + ' ' + dish.cuisine + ' ' + dish.name + ' ' + dish.description).toLowerCase();
  if (hay.includes(key)) return true;
  const cuisines = STATE_CUISINES[key];
  if (cuisines && cuisines.includes(String(dish.cuisine || '').toLowerCase())) return true;
  return false;
}

function budgetFit(cost, household) {
  const budget = Number(household && household.weeklyBudgetINR) || 3000;
  const people = Math.max(1, ((household && household.members) || []).length);
  const perMeal = budget / 7 / people / 2;
  return Math.max(0, Math.min(1, 1 - (Number(cost) || 40) / Math.max(40, perMeal)));
}

function localScore(dish, profile, household, state) {
  const cw = numWeight(profile && profile.cuisineWeights, dish.cuisine);
  const tw = (dish.tags || []).reduce((s, t) => s + numWeight(profile && profile.tagWeights, t), 0);
  const spiceFit = 1 - Math.min(1, Math.abs((dish.spice || 3) - ((profile && profile.spiceTarget) || 3)) / 4);
  const stateBoost = state && state !== 'All' && matchesState(dish, state) ? 0.6 : 0;
  return 2.0 * cw + 0.8 * tw + 0.5 * spiceFit + 0.4 * budgetFit(dish.estimatedCostPerServingINR, household) + stateBoost + Math.random() * 0.25;
}

function toLocalCard(dish, ingredientMap, stateName) {
  const names = (dish.ingredients || [])
    .map(r => {
      const ing = ingredientMap.get(String(r.ingredientId));
      return ing ? ing.name : '';
    })
    .filter(Boolean);
  const moods = MOODS.filter(m => matchesMood({ ...dish, tags: dish.tags || [], name: dish.name, region: (dish.regionTags || [])[0] || '' }, m));
  return {
    id: String(dish._id),
    name: dish.name,
    nameHi: dish.nameHi,
    cuisine: dish.cuisine || 'Indian',
    region: (dish.regionTags && dish.regionTags[0]) || stateName || 'India',
    diet: dish.diet,
    mood: moodOf(dish),
    moods,
    prepMinutes: dish.prepMinutes,
    description: (dish.steps && dish.steps[0]) || `${dish.cuisine || 'Indian'} ${dish.diet} dish`,
    ingredients: names,
    steps: dish.steps || [],
    thumbnail: dish.imageUrl || dishImages[dish.name] || null,
    youtubeUrl: yt(dish.name),
    source: 'catalogue',
    tags: dish.tags || []
  };
}

function inferExternalDiet(name, ingredients, declared) {
  const hay = name + ' ' + ingredients.join(' ');
  if (NONVEG_RE.test(hay)) return 'nonveg';
  if (EGG_RE.test(hay)) return 'eggetarian';
  if (declared === 'nonveg' || declared === 'eggetarian') return declared;
  return 'veg';
}

function normalizeExternal(m, state) {
  const ing = [];
  for (let i = 1; i <= 20; i++) {
    const x = m['strIngredient' + i];
    if (x && x.trim()) ing.push(x.trim());
  }
  const steps = (m.strInstructions || '').split(/\r?\n+/).map(s => s.trim()).filter(s => s.length > 5).slice(0, 6);
  const name = m.strMeal || '';
  const area = (m.strArea || '').toLowerCase();
  const isIndianDish = area.includes('indian') || area.includes('pakistan') || area.includes('bangladesh');
  const region = isIndianDish ? (state || 'India') : (m.strArea || 'World');
  const diet = inferExternalDiet(name, ing, 'veg');
  const base = {
    name,
    cuisine: m.strArea || 'International',
    region,
    diet,
    prepMinutes: 20 + (name.length * 7) % 35,
    description: steps[0] ? steps[0].slice(0, 150) : 'Popular recipe',
    ingredients: ing.slice(0, 10),
    steps,
    thumbnail: m.strMealThumb || null,
    youtubeUrl: m.strYoutube || yt(name),
    source: 'themealdb',
    tags: []
  };
  base.mood = moodOf(base);
  return base;
}

async function fetchMealDBMulti(qs, state) {
  const batches = await Promise.all(qs.slice(0, 6).map(async q => {
    const { signal, done } = withTimeout(5000);
    try {
      const res = await fetch('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(q), { signal });
      if (!res.ok) return [];
      const json = await res.json();
      return json.meals || [];
    } catch {
      return [];
    } finally {
      done();
    }
  }));
  const seen = new Set();
  return batches.flat()
    .filter(m => {
      if (!m || !m.idMeal || seen.has(m.idMeal)) return false;
      seen.add(m.idMeal);
      return true;
    })
    .map(m => normalizeExternal(m, state));
}

async function fetchAI(mood, state) {
  let instruction;
  if (state) {
    instruction = 'Give 12 unique ' + state + ' dishes from India, including home style and speciality dishes.';
  } else if (mood && mood !== 'all') {
    instruction = 'Give 12 unique ' + mood + ' dishes from India, Pakistan and Bangladesh. Include lesser known and homestyle dishes.';
  } else {
    instruction = 'Give 14 unique Indian dishes from ALL states: street, regional, festival and tribal specialities.';
  }
  const parsed = await chatJSON([
    {
      role: 'system',
      content: 'Return ONLY JSON: {"dishes":[{"name":"","description":"","ingredients":[],"steps":[],"cuisine":"","region":"","diet":"veg|nonveg|eggetarian","prepMinutes":30,"mood":"' + MOODS.join('|') + '"}]}'
    },
    {
      role: 'user',
      content: instruction + (mood && mood !== 'all' ? ' Every dish must use mood exactly "' + mood + '".' : '') + (state ? ' Every dish must belong to ' + state + '.' : '')
    }
  ], { perModelTimeoutMs: 9000, totalTimeoutMs: 16000 });
  if (!parsed) return [];
  return (parsed.dishes || []).map(d => {
    const name = String(d.name || '').trim();
    if (!name) return null;
    const ingredients = Array.isArray(d.ingredients) ? d.ingredients.map(String) : [];
    const base = {
      name,
      cuisine: d.cuisine || 'Indian',
      region: d.region || state || 'India',
      diet: inferExternalDiet(name, ingredients, d.diet),
      prepMinutes: Number(d.prepMinutes) || 30,
      description: d.description || 'Unique dish',
      ingredients,
      steps: Array.isArray(d.steps) ? d.steps.map(String) : [],
      thumbnail: dishImages[name] || null,
      youtubeUrl: yt(name),
      source: 'ai',
      tags: []
    };
    base.mood = moodOf(base);
    return base;
  }).filter(Boolean);
}

async function fetchYT(q) {
  const qs = [q || 'Indian food recipe', 'street food India recipe', 'regional India recipe', 'desi food recipe'];
  if (!env.YOUTUBE_API_KEY) {
    return qs.map(x => ({ title: x, channel: 'YouTube', videoId: '', thumbnail: null, url: yt(x), source: 'youtube' }));
  }
  const { signal, done } = withTimeout(7000);
  try {
    const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=' + encodeURIComponent(qs[Math.floor(Math.random() * qs.length)]) + '&type=video&maxResults=12&order=date&key=' + env.YOUTUBE_API_KEY;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('yt');
    const json = await res.json();
    return (json.items || []).map(v => ({
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      videoId: v.id.videoId,
      thumbnail: v.snippet.thumbnails?.medium?.url || null,
      url: 'https://www.youtube.com/watch?v=' + v.id.videoId,
      source: 'youtube'
    }));
  } catch {
    return [];
  } finally {
    done();
  }
}

// External enrichment is shared by every household: cache the raw pool per
// mood/state and apply the household diet at request time. The browse page is
// then served from the local catalogue instantly and enriched on later loads.
const POOL_TTL = 15 * 60 * 1000;
const POOL_RETRY = 60 * 1000;
const poolCache = new Map();

function ensurePool(key, mood, state) {
  const now = Date.now();
  const cur = poolCache.get(key);
  if (cur && cur.inflight) return cur;
  if (cur && now - cur.at < POOL_TTL) return cur;
  if (cur && cur.failedAt && now - cur.failedAt < POOL_RETRY) return cur;

  const entry = cur || { at: 0, dishes: [], videos: [] };
  entry.inflight = true;
  poolCache.set(key, entry);

  const qs = state
    ? [state + ' recipe', state + ' food', 'indian ' + state]
    : mood && mood !== 'all'
      ? [mood + ' food india', 'india ' + mood, mood + ' recipe']
      : ['indian', 'curry', 'rice', 'chicken', 'fish', 'vegetable', 'dessert', 'bread'];

  Promise.all([fetchAI(mood, state), fetchMealDBMulti(qs, state), fetchYT(state || mood)])
    .then(([ai, meal, videos]) => {
      const seen = new Set();
      entry.dishes = [...ai, ...meal].filter(d => {
        const k = String(d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      entry.videos = videos;
      entry.at = Date.now();
      entry.failedAt = entry.dishes.length ? null : Date.now();
    })
    .catch(() => {
      entry.failedAt = Date.now();
    })
    .finally(() => {
      entry.inflight = false;
    });

  return entry;
}

function externalAllowed(dish, dietSig, allergies, neverNames) {
  const strictVeg = dietSig === 'veg' || dietSig === 'vegan' || dietSig === 'jain' || dietSig === 'sattvic';
  if (strictVeg && dish.diet !== 'veg') return false;
  if (dietSig === 'eggetarian' && dish.diet === 'nonveg') return false;

  const hay = (dish.name + ' ' + (dish.ingredients || []).join(' ')).toLowerCase();
  if (dietSig === 'jain' && JAIN_RE.test(hay)) return false;
  if (dietSig === 'sattvic' && SATTVIC_RE.test(hay)) return false;
  if (dietSig === 'vegan' && VEGAN_RE.test(hay)) return false;
  if (allergies.some(a => hay.includes(a))) return false;
  if (neverNames.some(n => n.length >= 3 && hay.includes(n))) return false;
  return true;
}

const EMPTY_PROFILE = {
  neverDishIds: [],
  neverIngredientIds: [],
  recentDishIds: [],
  spiceTarget: 3,
  oilTarget: 3,
  weightPref: {}
};

export async function discoverUniqueDishes({ q, mood = 'all', state, household } = {}) {
  const term = String(q || '').trim().toLowerCase();
  const browse = !term;
  const key = String(mood) + '|' + String(state || '');
  const pool = browse ? ensurePool(key, mood, state) : { dishes: [], videos: [] };

  const [{ dishes: catalogue, ingredients }, profileDoc] = await Promise.all([
    loadCatalogue(),
    household ? TasteProfile.findOne({ householdId: household._id }).lean().catch(() => null) : Promise.resolve(null)
  ]);

  const profile = { ...EMPTY_PROFILE, ...(profileDoc || {}) };
  const dietSig = dietSignature(household);
  const allergies = memberAllergies(household);
  const neverNames = (profile.neverIngredientIds || [])
    .map(id => ingredients.get(String(id)))
    .filter(Boolean)
    .map(i => String(i.name || '').toLowerCase());

  const stateName = state && state !== 'All' ? state : '';

  let local = catalogue
    .filter(d => hardFilterDish(d, profile, household, [], ingredients))
    .map(d => ({ card: toLocalCard(d, ingredients, stateName), doc: d }))
    .filter(x => matchesMood(x.card, mood))
    .map(x => ({ ...x, score: localScore(x.doc, profile, household, state) }));

  const stateMatched = stateName ? local.filter(x => matchesState(x.card, stateName)) : [];
  if (stateName && stateMatched.length >= 6) local = stateMatched;
  else if (stateName) local = stateMatched.concat(local.filter(x => !stateMatched.includes(x)));

  if (term) {
    local = local.filter(x => {
      const hay = (x.card.name + ' ' + (x.card.nameHi || '') + ' ' + x.card.cuisine + ' ' + (x.card.tags || []).join(' ')).toLowerCase();
      return hay.includes(term);
    });
  }

  local.sort((a, b) => b.score - a.score);

  const known = new Set(local.map(x => x.card.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const external = (pool.dishes || [])
    .filter(d => externalAllowed(d, dietSig, allergies, neverNames))
    .filter(d => matchesMood(d, mood))
    .filter(d => !stateName || matchesState(d, stateName))
    .sort((a, b) => (matchesState(b, stateName) ? 1 : 0) - (matchesState(a, stateName) ? 1 : 0) + (Math.random() - 0.5) * 0.3)
    .filter(d => {
      const k = d.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (known.has(k)) return false;
      known.add(k);
      return true;
    });

  const localCards = local.slice(0, 48).map(x => x.card);
  const localCount = localCards.length;
  const queue = external.slice(0, 32);
  const dishes = localCards.splice(0, 6);
  while (localCards.length || queue.length) {
    if (localCards.length) dishes.push(localCards.shift());
    if (localCards.length) dishes.push(localCards.shift());
    if (queue.length) dishes.push(queue.shift());
  }

  return {
    aiEnabled: aiEnabled(),
    youtubeEnabled: Boolean(env.YOUTUBE_API_KEY),
    personalized: {
      diet: dietSig,
      allergies,
      neverCount: neverNames.length,
      localCount
    },
    dishes,
    videos: (pool.videos || []).slice(0, 16)
  };
}
