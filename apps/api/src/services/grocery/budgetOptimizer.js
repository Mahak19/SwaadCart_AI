export function optimizeBudget(items, budgetINR) {
  const total = items.reduce((s, i) => s + (i.estPriceINR || 0), 0);
  if (total <= budgetINR) return { items, total, adjusted: false, notes: [] };
  const sorted = [...items].sort((a, b) => (a.priority || 5) - (b.priority || 5));
  let running = total;
  const notes = [];
  for (const item of sorted) {
    if (running <= budgetINR) break;
    const cut = Math.min(item.estPriceINR || 0, running - budgetINR);
    item.estPriceINR = Math.max(0, (item.estPriceINR || 0) - cut);
    item.optional = true;
    running -= cut;
    notes.push('Flagged ' + (item.name || 'item') + ' as optional to stay in budget');
  }
  return { items, total: running, adjusted: true, notes };
}
