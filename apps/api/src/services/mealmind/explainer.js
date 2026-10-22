export function buildReasons({ dish, inventoryIds, profile, weatherBucket, slot }) {
  const reasons = [];
  const essential = (dish.ingredients || []).filter(i => i.essential);
  const inStock = essential.filter(i => inventoryIds.has(String(i.ingredientId)));
  if (essential.length && inStock.length === essential.length) {
    const names = essential.map(i => i.name || 'ingredients you have').slice(0,3).join(', ');
    reasons.push('You already have ' + names + ' on hand. No shopping needed.');
  } else if (inStock.length) {
    const names = essential.filter(i => inventoryIds.has(String(i.ingredientId))).map(i => i.name).slice(0,2).join(', ');
    reasons.push('Uses the ' + names + ' you already have.');
  }
  if (reasons.length < 3 && (dish.weatherFit || []).includes(weatherBucket)) {
    const phrases = { hot: 'light for a hot day', humid: 'fits a humid evening', mild: 'good for mild weather', cool: 'warming for cool weather', rainy: 'cozy for a rainy day' };
    reasons.push(phrases[weatherBucket] || 'suits the weather');
  }
  if (reasons.length < 3 && dish.cuisine) {
    const cw = (profile.cuisineWeights && profile.cuisineWeights.get(dish.cuisine)) || 0;
    if (cw > 0.5) reasons.push('You liked ' + dish.cuisine + ' food before');
  }
  if (reasons.length < 3 && dish.weight === 'light') {
    reasons.push('A lighter ' + (slot || 'meal') + ' option');
  }
  return reasons.slice(0, 3);
}
