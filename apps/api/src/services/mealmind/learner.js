export const FEEDBACK_DELTA = { love: 3, like: 1, okay: 0, dislike: -2 };
export const ALPHA_BASE = 0.3;
export const HALF_LIFE_DAYS = 60;
const MAX_LOG = 50;

function clampWeight(n) { return Math.max(-5, Math.min(5, n)); }

function learningRate(feedbackCount) {
  return ALPHA_BASE * Math.exp(-feedbackCount / 40);
}

function bumpMap(map, key, delta) {
  if (!map) return;
  const current = map.get(key) || 0;
  map.set(key, clampWeight(current + delta));
}

export function applyFeedback(profile, { dish, action, reasons = [], slot = 'dinner', ingredientBlamed = null }) {
  const alpha = learningRate(profile.feedbackCount || 0);
  const delta = FEEDBACK_DELTA[action] ?? 0;
  const log = [];

  if (dish) {
    (dish.tags || []).forEach(t => bumpMap(profile.tagWeights, t, delta * alpha));
    if (dish.cuisine) bumpMap(profile.cuisineWeights, dish.cuisine, delta * alpha);
    (dish.ingredients || []).forEach(i => bumpMap(profile.ingredientWeights, String(i.ingredientId), delta * alpha));
  }

  if (action === 'never' && dish) {
    if (!profile.neverDishIds.map(String).includes(String(dish._id))) {
      profile.neverDishIds.push(dish._id);
    }
    log.push({ at: new Date(), message: 'Permanently removed: ' + (dish.name || 'this dish'), delta: 'never' });
  }

  if (reasons.includes('too-spicy')) {
    profile.spiceTarget = Math.max(1, (profile.spiceTarget || 3) - 0.5);
    log.push({ at: new Date(), message: 'Less spice from now on', delta: 'spice-0.5' });
  }
  if (reasons.includes('too-oily')) {
    profile.oilTarget = Math.max(1, (profile.oilTarget || 3) - 0.5);
    log.push({ at: new Date(), message: 'Prefers less oil now', delta: 'oil-0.5' });
  }
  if (reasons.includes('too-heavy')) {
    const pref = profile.weightPref || (profile.weightPref = {});
    pref[slot] = Math.max(-1, (pref[slot] || 0) - 0.2);
    log.push({ at: new Date(), message: 'Noted: you prefer lighter ' + slot + 's', delta: slot + '-0.2' });
  }
  if (reasons.includes('dont-like-ingredient') && ingredientBlamed) {
    bumpMap(profile.ingredientWeights, String(ingredientBlamed), -2.5);
    log.push({ at: new Date(), message: 'Ingredient deprioritised', delta: 'ing-2.5' });
  }
  if (reasons.includes('dont-like-cuisine') && dish && dish.cuisine) {
    bumpMap(profile.cuisineWeights, dish.cuisine, -3);
    log.push({ at: new Date(), message: 'Cuisine deprioritised', delta: 'cuisine-3' });
  }
  if (reasons.includes('eaten-recently')) {
    log.push({ at: new Date(), message: 'Short cooldown added, no taste penalty', delta: 'cooldown' });
  }

  if (action === 'love' && dish) {
    log.push({ at: new Date(), message: (dish.name || 'This dish') + ' is now a favourite', delta: 'love' });
  }

  profile.feedbackCount = (profile.feedbackCount || 0) + 1;
  profile.explorationRate = Math.max(0.05, 0.35 * Math.exp(-profile.feedbackCount / 40));

  const existing = profile.learningLog || (profile.learningLog = []);
  log.forEach(l => existing.push(l));
  if (existing.length > MAX_LOG) existing.splice(0, existing.length - MAX_LOG);

  return log;
}

export function applyTimeDecay(profile, now = new Date()) {
  const days = (now - (profile.updatedAt || now)) / (1000 * 60 * 60 * 24);
  if (days <= 0 || days > HALF_LIFE_DAYS * 3) return profile;
  const factor = Math.pow(0.5, days / HALF_LIFE_DAYS);
  ['tagWeights', 'cuisineWeights', 'ingredientWeights'].forEach(key => {
    const map = profile[key];
    if (!map) return;
    map.forEach((v, k) => map.set(k, v * factor));
  });
  profile.updatedAt = now;
  return profile;
}
