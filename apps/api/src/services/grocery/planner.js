import { packSizeFor, estimatePrice } from './packSizing.js';
import { predictDepletion, frequentBuyer } from './depletionPredictor.js';
import { optimizeBudget } from './budgetOptimizer.js';
import { enrichUnlocks } from './unlockCounter.js';

export function aggregateNeeds(plannedDishes, members = []) {
  const needs = new Map();
  for (const dish of plannedDishes) {
    const factor = members.reduce((s, m) => s + (m.consumptionFactor || 1), 0) / Math.max(1, members.length);
    for (const ing of (dish.ingredients || [])) {
      const key = String(ing.ingredientId);
      needs.set(key, (needs.get(key) || 0) + (ing.qtyPerServing || 100) * (ing.essential ? 1 : 0.5) * factor);
    }
  }
  return needs;
}

export function subtractInventory(needs, inventory = []) {
  const invMap = new Map();
  inventory.forEach(iv => {
    const exp = iv.expiresAt ? new Date(iv.expiresAt) : null;
    if (exp && exp < new Date()) return;
    invMap.set(String(iv.ingredientId), (invMap.get(String(iv.ingredientId)) || 0) + (iv.quantity || 0));
  });
  const result = new Map();
  for (const [k, v] of needs) {
    const have = invMap.get(k) || 0;
    const remaining = v - have;
    if (remaining > 0) result.set(k, remaining);
  }
  return result;
}

export function buildGroceryItems(needs, ingredientCatalog = [], purchases = [], plannedDishes = []) {
  const items = [];
  for (const [ingId, qty] of needs) {
    const ing = ingredientCatalog.find(i => String(i._id) === String(ingId));
    if (!ing) continue;
    const pack = packSizeFor(qty, ing.packSizes || []);
    const estPrice = estimatePrice(qty, ing.packSizes || [], ing.avgPricePerBaseUnitINR || 0.05);
    const reasons = ['needed-for-meals'];
    const depletion = predictDepletion(purchases, ingId);
    if (depletion && depletion.shouldAdd) reasons.push('running-low');
    if (frequentBuyer(purchases, ingId)) reasons.push('frequent-buy');
    const unlocks = enrichUnlocks([{ ingredientId: ingId }], plannedDishes)[0].unlocksCount;
    items.push({
      ingredientId: ingId,
      name: ing.name,
      qty: Math.ceil(qty),
      unit: ing.baseUnit,
      packSuggestion: pack.qty + ' ' + ing.baseUnit,
      estPriceINR: estPrice,
      reasons,
      unlocksCount: unlocks,
      checked: false,
      addedBy: 'ai',
      priority: ing.isStaple ? 2 : 5
    });
  }
  return items;
}

export function planGrocery({ plannedDishes, members, inventory, ingredientCatalog, purchases, budgetINR }) {
  const needs = aggregateNeeds(plannedDishes, members);
  const afterInventory = subtractInventory(needs, inventory);
  let items = buildGroceryItems(afterInventory, ingredientCatalog, purchases, plannedDishes);
  items = enrichUnlocks(items, plannedDishes);
  const { items: optimizedItems, total, adjusted, notes } = optimizeBudget(items, budgetINR);
  return {
    items: optimizedItems,
    estimatedTotalINR: total,
    budgetAdjusted: adjusted,
    notes,
    changeLog: notes.map(n => ({ at: new Date(), message: n }))
  };
}
