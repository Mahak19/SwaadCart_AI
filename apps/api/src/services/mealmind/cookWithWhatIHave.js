import { fuzzyMatch } from '../../utils/fuzzyMatch.js';
import { chatJSON, aiEnabled } from '../ai.service.js';

const SEASONING = new Set(['spice', 'oil']);
const DIETS = new Set(['veg', 'eggetarian', 'nonveg']);

export function normalizeIngredientInput(input, catalog) {
  const tokens = input.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  return tokens.map(tok => {
    let best = null, bestScore = 0;
    for (const ing of catalog) {
      const names = [ing.name, ing.nameHi, ...(ing.aliases || [])].map(n => (n || '').toLowerCase());
      for (const n of names) {
        const s = fuzzyMatch(tok, n);
        if (s > bestScore) { bestScore = s; best = ing; }
      }
    }
    return { raw: tok, ingredient: bestScore >= 0.5 ? best : null };
  });
}

function ytLink(query) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + ' recipe');
}

// Households may declare stricter diets than a dish's own tag (jain, vegan).
// Expand each declared diet into the dish tags it is allowed to eat, so a
// jain household still sees every veg dish (jain implies veg, vegan implies
// veg) instead of matching nothing.
const DIET_COMPAT = {
  veg: ['veg'],
  vegan: ['veg'],
  jain: ['veg'],
  sattvic: ['veg'],
  eggetarian: ['veg', 'eggetarian'],
  nonveg: ['veg', 'eggetarian', 'nonveg']
};

function allowedDiets(household) {
  const tags = new Set();
  for (const m of household?.members || []) {
    for (const t of DIET_COMPAT[m.diet] || (m.diet ? [m.diet] : [])) tags.add(t);
  }
  return tags;
}

function refIngredient(ref, catalogById) {
  if (!ref) return null;
  const id = ref.ingredientId && ref.ingredientId._id ? String(ref.ingredientId._id) : String(ref.ingredientId);
  return catalogById.get(id) || null;
}

// Real dishes from the seeded recipe bank, ranked by how much of what the
// user already has the dish actually uses. Pantry seasonings (spice/oil
// category) are assumed present so a dish is not rejected for "missing salt".
function matchCatalogDishes(resolved, dishes, catalogById, profile, household) {
  const userItems = resolved.filter(r => r.ingredient);
  const userIds = new Set(userItems.map(r => String(r.ingredient._id)));
  const realItems = userItems.filter(r => !SEASONING.has(r.ingredient.category));
  if (userIds.size < 2 || realItems.length < 1) return [];

  const diets = allowedDiets(household);
  const spiceTarget = (profile && profile.spiceTarget) || 3;

  const out = [];
  for (const dish of dishes) {
    if (diets.size && !diets.has(dish.diet)) continue;

    const all = (dish.ingredients || [])
      .map(ref => ({ ref, ing: refIngredient(ref, catalogById) }))
      .filter(x => x.ing);
    const required = all.filter(x => !SEASONING.has(x.ing.category) && x.ref.essential !== false);
    if (!required.length) continue;

    const matchedAll = all.filter(x => userIds.has(String(x.ing._id)));
    if (matchedAll.length < Math.min(2, userIds.size)) continue;

    const haveReq = required.filter(x => userIds.has(String(x.ing._id)));
    const coverage = haveReq.length / required.length;
    if (coverage < 0.5) continue;

    const precision = matchedAll.length / userIds.size;
    const spiceFit = 1 - Math.min(1, Math.abs((dish.spice || 3) - spiceTarget) / 4);
    const score = 0.7 * coverage + 0.2 * precision + 0.1 * spiceFit;

    out.push({
      source: 'catalog',
      sourceLabel: 'Recipe bank',
      dishId: dish._id,
      name: dish.name,
      nameHi: dish.nameHi,
      diet: dish.diet,
      cuisine: dish.cuisine,
      spice: dish.spice,
      oil: dish.oil,
      tags: dish.tags || [],
      prepMinutes: dish.prepMinutes,
      caloriesApprox: dish.caloriesApprox,
      estimatedCostPerServingINR: dish.estimatedCostPerServingINR,
      imageUrl: dish.imageUrl,
      steps: dish.steps || [],
      ingredients: all.map(x => ({
        name: x.ing.name,
        qtyPerServing: x.ref.qtyPerServing,
        essential: x.ref.essential !== false,
        have: userIds.has(String(x.ing._id))
      })),
      matched: matchedAll.map(x => x.ing.name),
      missing: required.filter(x => !userIds.has(String(x.ing._id))).map(x => x.ing.name),
      haveCount: haveReq.length,
      needCount: required.length,
      coverage: Number(coverage.toFixed(2)),
      score: Number(score.toFixed(3)),
      youtubeUrl: ytLink(dish.name)
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function isPantry(name, catalog) {
  const lower = String(name || '').toLowerCase();
  return catalog.some(i => {
    if (!SEASONING.has(i.category)) return false;
    const names = [i.name, i.nameHi, ...(i.aliases || [])].map(n => String(n || '').toLowerCase());
    return names.some(n => n && (fuzzyMatch(lower, n) >= 0.6 || n.includes(lower) || lower.includes(n)));
  });
}

// A genuine, cooked-to-order recipe from the configured AI provider.
// Returns null (caller falls back to the catalog) on timeout, bad JSON or
// answers that are too thin to be a real recipe.
export async function generateAIRecipe({ items, spiceTarget, household, catalog }) {
  if (!aiEnabled() || !items.length) return null;

  const diets = allowedDiets(household);
  const requestedDiets = new Set((household?.members || []).map(m => m.diet).filter(Boolean));
  const RULES = {
    jain: 'Jain (strict): absolutely no onion, garlic, potato, carrot, beetroot, radish, mushroom or ginger.',
    sattvic: 'Sattvic: no onion and no garlic (other vegetables like potato, carrot, tomato are fine).',
    vegan: 'Vegan: no dairy, egg, ghee or honey.',
    eggetarian: 'Vegetarian plus egg (no meat or fish).',
    veg: 'Vegetarian (no meat, fish or egg).',
    nonveg: 'No restrictions.'
  };
  const dietHint = requestedDiets.size
    ? 'Household diet: ' + [...requestedDiets].map(d => RULES[d] || d).join(' ') + ' The recipe MUST obey this.'
    : 'Any diet is fine.';
  const spiceHint = spiceTarget >= 4 ? 'spicy (4-5/5)' : spiceTarget <= 2 ? 'mild (1-2/5)' : 'medium (' + spiceTarget + '/5)';

  const p = await chatJSON([
    {
      role: 'system',
      content:
        'You are SwaadCart AI, a home cook for Indian kitchens. Reply ONLY with JSON: ' +
        '{"name":"dish name","cuisine":"cuisine","diet":"veg|eggetarian|nonveg","prepMinutes":30,' +
        '"caloriesApprox":400,"estimatedCostPerServingINR":60,' +
        '"ingredients":[{"name":"ingredient","qty":"2 medium"}],' +
        '"steps":["specific step mentioning quantities, heat level and timing"]}. ' +
        'Use ONLY the ingredients the user has, plus standard pantry items (salt, oil, haldi, mirch, jeera, garam masala). ' +
        'Write 6 to 9 real cooking steps with concrete quantities, times and pan/heat details — never vague lines like "chop and add" or "cook till done".'
    },
    {
      role: 'user',
      content:
        'Ingredients I have right now: ' + items.join(', ') + '. ' +
        dietHint + ' Spice level: ' + spiceHint + '. What single dish should I cook?'
    }
  ], { perModelTimeoutMs: 7000, totalTimeoutMs: 11000 });
  try {
    if (!p) return null;
    const steps = (Array.isArray(p.steps) ? p.steps : [])
      .map(s => String(s || '').trim())
      .filter(s => s.length >= 15);
    const rawIngredients = Array.isArray(p.ingredients) ? p.ingredients : [];
    const ingredients = rawIngredients
      .map(x => typeof x === 'string'
        ? { name: x.trim(), qty: '' }
        : { name: String(x && x.name ? x.name : '').trim(), qty: String(x && (x.qty || x.quantity) ? (x.qty || x.quantity) : '').trim() })
      .filter(x => x.name);
    if (!p.name || steps.length < 4 || ingredients.length < 2) return null;

    const diet = DIETS.has(p.diet) ? p.diet : 'veg';
    if (diets.size && !diets.has(diet)) return null;

    const userLower = items.map(i => String(i).toLowerCase());
    const haveFlags = ingredients.map(x => {
      const lower = x.name.toLowerCase();
      const inKitchen = userLower.some(u => u.includes(lower) || lower.includes(u) || fuzzyMatch(u, lower) >= 0.6);
      return { ...x, have: inKitchen || isPantry(x.name, catalog) };
    });

    return {
      source: 'ai',
      sourceLabel: 'AI Chef',
      name: String(p.name).trim(),
      diet,
      cuisine: p.cuisine ? String(p.cuisine) : 'Indian',
      prepMinutes: Number(p.prepMinutes) || 30,
      caloriesApprox: Number(p.caloriesApprox) || null,
      estimatedCostPerServingINR: Number(p.estimatedCostPerServingINR) || null,
      steps,
      ingredients: haveFlags,
      matched: haveFlags.filter(x => x.have).map(x => x.name),
      missing: haveFlags.filter(x => !x.have).map(x => x.name),
      haveCount: haveFlags.filter(x => x.have).length,
      needCount: haveFlags.length,
      youtubeUrl: ytLink(String(p.name).trim())
    };
  } catch {
    return null;
  }
}

// Repeated "cook with what I have" taps reuse the same AI recipe instead of
// paying for another model round-trip; the recipe stays valid for half an hour.
const AI_TTL = 30 * 60 * 1000;
const aiCache = new Map();

function aiCacheKey(items, spiceTarget, household) {
  const diets = ((household && household.members) || []).map(m => m.diet).sort().join(',');
  return diets + '|' + spiceTarget + '|' + items.map(i => String(i).toLowerCase()).sort().join(',');
}

async function cachedAIRecipe(args) {
  const key = aiCacheKey(args.items, args.spiceTarget, args.household);
  const hit = aiCache.get(key);
  if (hit && Date.now() - hit.at < AI_TTL) return hit.recipe;
  const recipe = await generateAIRecipe(args);
  if (recipe) {
    aiCache.set(key, { at: Date.now(), recipe });
    if (aiCache.size > 100) {
      const oldest = [...aiCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) aiCache.delete(oldest[0]);
    }
  }
  return recipe;
}

export async function cookWithWhatIHave(input, catalog, profile, household, dishes = []) {
  const resolved = normalizeIngredientInput(input, catalog);

  const matches = resolved
    .filter(r => r.ingredient)
    .map(r => ({ id: String(r.ingredient._id), name: r.ingredient.name, category: r.ingredient.category, raw: r.raw }));
  const unmatched = resolved.filter(r => !r.ingredient).map(r => r.raw);

  const catalogById = new Map(catalog.map(i => [String(i._id), i]));
  const catalogOptions = matchCatalogDishes(resolved, dishes, catalogById, profile, household).slice(0, 5);

  const userItems = resolved.filter(r => r.ingredient);
  const realItems = userItems.filter(r => !SEASONING.has(r.ingredient.category));
  const canCook = resolved.length >= 2 && (realItems.length >= 1 || unmatched.length >= 1);

  // If the recipe bank already covers the pantry well, answer instantly with
  // real seeded recipes (with photos + steps) instead of waiting on the LLM.
  const strongCatalog = catalogOptions.length >= 2 && catalogOptions[0].coverage >= 0.8;

  const aiOption = canCook && !strongCatalog
    ? await cachedAIRecipe({
        items: resolved.map(r => r.ingredient ? r.ingredient.name : r.raw),
        spiceTarget: (profile && profile.spiceTarget) || 3,
        household,
        catalog
      })
    : null;

  const options = [aiOption, ...catalogOptions].filter(Boolean);

  return {
    matched: matches,
    unmatched,
    resolvedNames: resolved.map(r => r.ingredient ? r.ingredient.name : r.raw),
    options,
    generated: options[0] || null,
    alternatives: options.slice(1),
    aiEnabled: aiEnabled(),
    hint: options.length
      ? null
      : 'List at least 2 things you have — e.g. aloo, paneer, chawal — and we will pull a real recipe for them.'
  };
}
