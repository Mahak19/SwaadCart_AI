import { WEIGHTS, WEATHER_WEIGHT_CAP } from '../../config/scoringWeights.js';

const JAIN_EXCLUDE = /onion|garlic|potato|aloo|carrot|beetroot|radish|mushroom|turnip|leek|spring onion|ginger/i;
const SATTVIC_EXCLUDE = /onion|garlic|leek|spring onion|scallion/i;
const VEGAN_EXCLUDE_CATEGORIES = new Set(['dairy']);
const VEGAN_EXCLUDE_NAMES = /egg|honey|paneer|curd|ghee|milk|butter|cheese|buttermilk|mayonnaise/i;

export function memberAllergies(household) {
  return [...new Set(((household && household.members) || [])
    .flatMap(m => m.allergies || [])
    .map(a => String(a).toLowerCase().trim())
    .filter(a => a.length >= 2))];
}

export function hardFilterDish(dish, profile, household, recentDishIds = [], ingredientMap = null) {
  if (profile.neverDishIds.map(String).includes(String(dish._id))) return false;

  // Honour the strictest diet across every household member.
  const diets = new Set(((household && household.members) || []).map(m => m.diet).filter(Boolean));
  if (!diets.size) diets.add('veg');
  const strictVeg = diets.has('veg') || diets.has('vegan') || diets.has('jain') || diets.has('sattvic');
  const noNonveg = strictVeg || diets.has('eggetarian');
  if (strictVeg && dish.diet !== 'veg') return false;
  if (!strictVeg && noNonveg && dish.diet === 'nonveg') return false;

  if (recentDishIds.map(String).includes(String(dish._id))) return false;
  const neverIng = profile.neverIngredientIds.map(String);
  if (dish.ingredients.some(i => neverIng.includes(String(i.ingredientId)))) return false;

  if (ingredientMap) {
    const names = dish.ingredients.map(i => {
      const ing = ingredientMap.get(String(i.ingredientId));
      return ing ? ing.name : '';
    });
    if (diets.has('jain')) {
      if (dish.diet !== 'veg') return false;
      if (names.some(n => JAIN_EXCLUDE.test(n))) return false;
    }
    if (diets.has('sattvic')) {
      if (dish.diet !== 'veg') return false;
      if (names.some(n => SATTVIC_EXCLUDE.test(n))) return false;
    }
    if (diets.has('vegan')) {
      if (dish.diet !== 'veg') return false;
      if (dish.ingredients.some(i => {
        const ing = ingredientMap.get(String(i.ingredientId));
        return ing && (VEGAN_EXCLUDE_CATEGORIES.has(ing.category) || VEGAN_EXCLUDE_NAMES.test(ing.name));
      })) return false;
    }
    const allergies = memberAllergies(household);
    if (allergies.length) {
      const lowered = names.map(n => (n || '').toLowerCase());
      if (lowered.some(n => n && allergies.some(a => n.includes(a) || a.includes(n)))) return false;
    }
  } else {
    if (diets.has('jain') && dish.diet !== 'veg') return false;
    if (diets.has('sattvic') && dish.diet !== 'veg') return false;
    if (diets.has('vegan') && dish.diet !== 'veg') return false;
  }
  return true;
}

export function weatherBucket({ tempC = 24, humidity = 50, code = 0 } = {}) {
  if (code >= 51 && code <= 82) return 'rainy';
  if (tempC >= 32) return 'hot';
  if (humidity >= 70 && tempC >= 28) return 'humid';
  if (tempC < 20) return 'cool';
  return 'mild';
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

export function scoreDish({ dish, profile, household, weather, inventoryIds, context = {}, recentCuisines = [], recentIngredients = [] }) {
  const breakdown = {};
  const w = WEIGHTS;

  const cuisineW = (profile.cuisineWeights && profile.cuisineWeights.get(dish.cuisine)) || 0;
  const tagW = dish.tags.reduce((s, t) => s + ((profile.tagWeights && profile.tagWeights.get(t)) || 0), 0);
  const ingW = dish.ingredients.reduce((s, i) => s + ((profile.ingredientWeights && profile.ingredientWeights.get(String(i.ingredientId))) || 0), 0);
  const tasteAffinity = clamp01((cuisineW + tagW + ingW) / 15 + 0.5);
  breakdown.tasteAffinity = tasteAffinity;

  const essential = dish.ingredients.filter(i => i.essential);
  const inStock = essential.filter(i => inventoryIds.has(String(i.ingredientId))).length;
  const ingredientCoverage = essential.length ? inStock / essential.length : 0;
  breakdown.ingredientCoverage = ingredientCoverage;

  const bucket = weatherBucket(weather);
  const weatherFit = (dish.weatherFit || []).includes(bucket) ? 1 : 0.3;
  breakdown.weatherFit = weatherFit;

  const regionStr = (household.region && household.region.state ? household.region.state : '').toLowerCase();
  const isLocal = (dish.regionTags || []).some(t => t.toLowerCase().includes(regionStr)) ||
    (dish.cuisine || '').toLowerCase().includes(regionStr);
  let cuisineMode;
  if (household.cuisineMode === 'local') cuisineMode = isLocal ? 1 : 0.15;
  else if (household.cuisineMode === 'explore') cuisineMode = isLocal ? 0.4 : 0.9;
  else cuisineMode = isLocal ? 0.8 : 0.5;
  breakdown.cuisineMode = cuisineMode;

  const spiceTarget = profile.spiceTarget || 3;
  const spiceFit = 1 - Math.min(1, Math.abs((dish.spice || 3) - spiceTarget) / 4);
  breakdown.spiceFit = spiceFit;

  const oilTarget = profile.oilTarget || 3;
  const oilFit = 1 - Math.min(1, Math.abs((dish.oil || 3) - oilTarget) / 4);
  breakdown.oilFit = oilFit;

  const appetite = context.appetite || 'normal';
  let contextFit;
  if (appetite === 'high' && (dish.weight === 'medium' || dish.weight === 'heavy')) contextFit = 0.9;
  else if (appetite === 'low' && dish.weight === 'light') contextFit = 0.9;
  else contextFit = 0.5;
  breakdown.contextFit = contextFit;

  const slotPref = (profile.weightPref && profile.weightPref[context.slot || 'dinner']) || 0;
  const dishHeavy = dish.weight === 'heavy' ? 1 : dish.weight === 'medium' ? 0.5 : 0;
  const slotWeightPref = clamp01(1 - Math.abs(dishHeavy - (slotPref + 1) / 2));
  breakdown.slotWeightPref = slotWeightPref;

  const cost = dish.estimatedCostPerServingINR || 40;
  const weeklyBudget = Number(household.weeklyBudgetINR) || 3000;
  const people = Math.max(1, ((household && household.members) || []).length);
  const dailyPerPerson = weeklyBudget / 7 / people;
  const budgetFit = clamp01(1 - cost / Math.max(50, dailyPerPerson));
  breakdown.budgetFit = budgetFit;

  let diversityPenalty = 0;
  if (recentCuisines.includes(dish.cuisine)) diversityPenalty -= 0.3;
  if (dish.ingredients.some(i => recentIngredients.includes(String(i.ingredientId)))) diversityPenalty -= 0.1;
  breakdown.diversityPenalty = diversityPenalty;

  const weatherScore = Math.min(weatherFit, WEATHER_WEIGHT_CAP);

  const score =
    tasteAffinity * w.tasteAffinity +
    ingredientCoverage * w.ingredientCoverage +
    weatherScore * (w.weatherFit / WEATHER_WEIGHT_CAP) * WEATHER_WEIGHT_CAP +
    cuisineMode * w.cuisineMode +
    spiceFit * w.spiceFit +
    oilFit * w.oilFit +
    contextFit * w.contextFit +
    slotWeightPref * 0.05 +
    budgetFit * w.budgetFit +
    diversityPenalty * Math.abs(w.diversityPenalty);

  return { score: Math.max(0, score), breakdown };
}
