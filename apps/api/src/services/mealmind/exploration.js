export function shouldExplore(profile) {
  const rate = profile.explorationRate ?? 0.15;
  return Math.random() < rate;
}

export function pickExploration(candidates, profile) {
  if (!candidates.length) return null;
  const topCuisines = [...(profile.cuisineWeights && typeof profile.cuisineWeights.entries === 'function'
    ? [...profile.cuisineWeights.entries()].sort((a,b) => b[1]-a[1]).slice(0,2).map(e => e[0])
    : [])];
  const novel = candidates.filter(c => !topCuisines.includes(c.dish.cuisine));
  const pool = novel.length ? novel : candidates;
  const idx = Math.floor(Math.random() * Math.min(pool.length, 5));
  const picked = pool[idx];
  return {
    ...picked,
    explored: true,
    exploreReason: 'You usually pick ' + (topCuisines[0] || 'familiar') + ' food; here is a ' +
      (picked.dish.cuisine || 'different') + ' option you have not tried.'
  };
}

export function forceSurprise(candidates, profile) {
  return pickExploration(candidates, profile) || candidates[0] || null;
}
