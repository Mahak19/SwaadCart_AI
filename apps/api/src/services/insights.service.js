import Purchase from '../models/Purchase.js';
import { predictDepletion, frequentBuyer } from './grocery/depletionPredictor.js';

export async function getSuggestions(householdId, inventory, ingredientCatalog) {
  const purchases = await Purchase.find({ householdId }).sort({ date: -1 }).limit(30).lean();
  const suggestions = [];

  for (const iv of inventory.slice(0, 10)) {
    const ing = ingredientCatalog.find(i => String(i._id) === String(iv.ingredientId));
    if (!ing) continue;
    const dep = predictDepletion(purchases, iv.ingredientId);
    if (dep && dep.shouldAdd && dep.daysUntilRunOut <= 7) {
      suggestions.push({
        title: 'You may need ' + ing.name + ' \u00b7 usually runs out by day ' + Math.round(dep.avgGapDays),
        reason: 'Based on your repurchase pattern',
        action: 'add',
        ingredientId: iv.ingredientId
      });
    }
  }

  const uniqueIngs = [...new Set(purchases.flatMap(p => (p.items||[]).map(i => String(i.ingredientId))))];
  for (const ingId of uniqueIngs.slice(0, 10)) {
    if (frequentBuyer(purchases, ingId)) {
      const ing = ingredientCatalog.find(i => String(i._id) === ingId);
      if (ing) {
        suggestions.push({
          title: ing.name + ' bought 4 weeks running \u00b7 add again?',
          reason: 'Recurring staple that fits this week\u2019s meal plan',
          action: 'add',
          ingredientId: ingId
        });
      }
    }
  }

  return suggestions.slice(0, 3);
}
