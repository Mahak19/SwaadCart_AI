export function unlockCountFor(ingredientId, plannedDishes = []) {
  let count = 0;
  for (const dish of plannedDishes) {
    const essential = (dish.ingredients || []).filter(i => i.essential);
    if (essential.length && essential.some(i => String(i.ingredientId) === String(ingredientId))) {
      count++;
    }
  }
  return count;
}

export function enrichUnlocks(groceryItems, plannedDishes) {
  return groceryItems.map(item => ({
    ...item,
    unlocksCount: unlockCountFor(item.ingredientId, plannedDishes)
  }));
}
