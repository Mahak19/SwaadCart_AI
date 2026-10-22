export function predictDepletion(purchases, ingredientId, lookAheadDays = 7) {
  const relevant = purchases
    .flatMap(p => p.items)
    .filter(i => String(i.ingredientId) === String(ingredientId));
  if (relevant.length < 2) return null;
  const sorted = relevant.map(i => i.date || i.createdAt || new Date()).sort((a, b) => new Date(a) - new Date(b));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((new Date(sorted[i]) - new Date(sorted[i-1])) / (1000*60*60*24));
  }
  const avgGap = gaps.reduce((a,b) => a+b, 0) / gaps.length;
  const last = new Date(sorted[sorted.length - 1]);
  const nextRunOut = new Date(last.getTime() + avgGap * 24*60*60*1000);
  const daysUntil = (nextRunOut - new Date()) / (1000*60*60*24);
  return { avgGapDays: avgGap, nextRunOut, daysUntilRunOut: daysUntil, shouldAdd: daysUntil <= lookAheadDays };
}

export function frequentBuyer(purchases, ingredientId, minWeeks = 3) {
  const weeks = new Set();
  purchases.forEach(p => {
    if ((p.items || []).some(i => String(i.ingredientId) === String(ingredientId))) {
      const d = new Date(p.date);
      const start = new Date(d);
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      weeks.add(start.toISOString().slice(0, 10));
    }
  });
  return weeks.size >= minWeeks;
}
