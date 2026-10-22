import { hardFilterDish, scoreDish } from './scorer.js';
import { buildReasons } from './explainer.js';
import { shouldExplore, pickExploration, forceSurprise } from './exploration.js';
import { weatherBucket } from './scorer.js';

export function recommendForSlot({ dishes, profile, household, weather, inventoryIds, slot, mode = 'normal', recentDishIds = [], recentCuisines = [], recentIngredients = [], ingredientMap = null }) {
  const candidates = dishes
    .filter(d => (d.slots || []).includes(slot))
    .filter(d => hardFilterDish(d, profile, household, recentDishIds, ingredientMap))
    .map(d => ({ dish: d, ...scoreDish({ dish: d, profile, household, weather, inventoryIds, context: { slot }, recentCuisines, recentIngredients }) }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;

  let chosen;
  if (mode === 'surprise') {
    chosen = forceSurprise(candidates, profile);
  } else if (shouldExplore(profile)) {
    chosen = pickExploration(candidates, profile) || candidates[0];
  } else {
    chosen = candidates[0];
  }

  const reasons = buildReasons({
    dish: chosen.dish,
    inventoryIds,
    profile,
    weatherBucket: weatherBucket(weather),
    slot
  });

  return {
    dish: chosen.dish,
    score: chosen.score,
    breakdown: chosen.breakdown,
    reasons,
    generatedBy: chosen.explored ? 'surprise' : 'mealmind'
  };
}

export function recommendDay({ dishes, profile, household, weather, inventoryIds, mode = 'normal', recentDishIds = [], recentCuisines = [], recentIngredients = [], ingredientMap = null }) {
  const slots = ['breakfast', 'lunch', 'snack', 'dinner'];
  const result = {};
  const usedDishIds = [];
  const usedCuisines = [];
  for (const slot of slots) {
    const rec = recommendForSlot({
      dishes, profile, household, weather, inventoryIds, slot, mode,
      recentDishIds: [...recentDishIds, ...usedDishIds],
      recentCuisines: [...recentCuisines, ...usedCuisines],
      recentIngredients,
      ingredientMap
    });
    if (rec) {
      result[slot] = rec;
      usedDishIds.push(String(rec.dish._id));
      usedCuisines.push(rec.dish.cuisine);
    }
  }
  return result;
}
