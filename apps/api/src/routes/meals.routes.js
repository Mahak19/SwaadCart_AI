import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Dish from '../models/Dish.js';
import MealPlan from '../models/MealPlan.js';
import Household from '../models/Household.js';
import TasteProfile from '../models/TasteProfile.js';
import InventoryItem from '../models/InventoryItem.js';
import Feedback from '../models/Feedback.js';
import { recommendDay, recommendForSlot } from '../services/mealmind/recommender.js';
import { getWeather } from '../services/weather.service.js';
import Ingredient from '../models/Ingredient.js';

const router = Router();
router.use(auth, householdScope);

router.get('/today', asyncHandler(async (req,res)=>{
  const date = req.query.date ? new Date(req.query.date) : new Date();
  date.setHours(0,0,0,0);
  const plan = await MealPlan.findOne({ householdId: req.user.householdId, date }).populate('slots.breakfast.dishId slots.lunch.dishId slots.snack.dishId slots.dinner.dishId');
  res.json(plan || { date, slots: {} });
}));

const ALL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

router.post('/generate', asyncHandler(async (req,res)=>{
  const dateStr = req.body.date ? new Date(req.body.date) : new Date();
  dateStr.setHours(0,0,0,0);
  const mode = req.body.mode || 'normal';
  const requestedSlots = Array.isArray(req.body.slots) && req.body.slots.length
    ? req.body.slots.filter(s => ALL_SLOTS.includes(s))
    : ALL_SLOTS;

  const household = await Household.findById(req.user.householdId);
  const profile = await TasteProfile.findOne({ householdId: req.user.householdId }) || await TasteProfile.create({ householdId: req.user.householdId });
  const dishes = await Dish.find().lean();
  const ingredients = await Ingredient.find().select('name category').lean();
  const ingredientMap = new Map(ingredients.map(i => [String(i._id), i]));
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const inventoryIds = new Set(inventory.filter(i => !i.expiresAt || new Date(i.expiresAt) >= new Date()).map(i => String(i.ingredientId)));
  const recentFb = await Feedback.find({ householdId: req.user.householdId }).sort({ createdAt: -1 }).limit(20).lean();
  const weather = await getWeather(household && household.region && household.region.lat, household && household.region && household.region.lng);

  const existing = await MealPlan.findOne({ householdId: req.user.householdId, date: dateStr });
  const currentDishBySlot = {};
  for (const slot of ALL_SLOTS) {
    const s = existing && existing.slots && existing.slots[slot];
    currentDishBySlot[slot] = s && s.dishId ? String(s.dishId) : null;
  }

  // Exclude dishes currently in today's plan, recently suggested dishes and
  // recent feedback so repeated regenerations keep producing new dishes instead
  // of cycling between the same two options.
  const feedbackIds = recentFb.map(f => String(f.dishId));
  const currentIds = ALL_SLOTS.map(s => currentDishBySlot[s]).filter(Boolean);
  const historyIds = (profile.recentDishIds || []).map(String);
  const excludeIds = new Set([...feedbackIds, ...currentIds, ...historyIds]);

  // Derive recently-eaten cuisines so small eligible pools still surface
  // variety instead of cycling the same cuisine every regeneration.
  const dishById = new Map(dishes.map(d => [String(d._id), d]));
  const recentCuisines = [...new Set([...excludeIds].map(id => dishById.get(String(id))?.cuisine).filter(Boolean))];

  const baseArgs = {
    dishes,
    profile,
    household: household || { members: [], cuisineMode: 'mixed' },
    weather,
    inventoryIds,
    mode,
    ingredientMap,
    recentCuisines
  };

  const recs = recommendDay({ ...baseArgs, recentDishIds: [...excludeIds] });

  // If exclusions exhausted a slot's pool, retry with progressively smaller
  // exclude lists (feedback, then recent history, then today's plan) so the
  // dish still changes for households with a tight eligible pool (e.g. jain).
  for (const slot of requestedSlots) {
    if (recs[slot]) continue;
    const tiers = [
      [...new Set([...currentIds, ...historyIds])],
      [...new Set([...currentIds, ...historyIds.slice(-4)])],
      [...new Set(historyIds.slice(-4))],
      currentIds,
      []
    ];
    for (const tier of tiers) {
      const rec = recommendForSlot({ ...baseArgs, slot, recentDishIds: tier });
      if (rec) { recs[slot] = rec; break; }
    }
  }

  const slots = {};
  // Preserve slots that are NOT being regenerated
  for (const slot of ALL_SLOTS) {
    if (!requestedSlots.includes(slot) && existing && existing.slots && existing.slots[slot] && existing.slots[slot].dishId) {
      slots[slot] = existing.slots[slot];
    }
  }
  // Fill regenerated slots; keep old dish if no new candidate found
  for (const slot of requestedSlots) {
    const rec = recs[slot];
    if (rec) {
      slots[slot] = {
        dishId: rec.dish._id,
        status: 'suggested',
        explanation: { reasons: rec.reasons, scoreBreakdown: rec.breakdown },
        generatedBy: rec.generatedBy,
        servings: 2
      };
    } else if (existing && existing.slots && existing.slots[slot] && existing.slots[slot].dishId) {
      slots[slot] = existing.slots[slot];
    }
  }

  const touchedIds = requestedSlots.map(s => slots[s] && slots[s].dishId).filter(Boolean);
  if (touchedIds.length) {
    await TasteProfile.updateOne(
      { householdId: req.user.householdId },
      { $push: { recentDishIds: { $each: touchedIds, $slice: -8 } } }
    );
  }

  const plan = await MealPlan.findOneAndUpdate(
    { householdId: req.user.householdId, date: dateStr },
    { householdId: req.user.householdId, date: dateStr, slots },
    { upsert: true, new: true }
  ).populate('slots.breakfast.dishId slots.lunch.dishId slots.snack.dishId slots.dinner.dishId');

  res.json(plan);
}));

// Generate a full week (7 days) of plans, keeping dishes distinct across days.
// Slots with a small eligible pool (e.g. jain breakfast) allow a repeat only
// after a 3-day gap so the user still gets genuine day-to-day variety.
router.post('/week', asyncHandler(async (req,res)=>{
  const start = req.body && req.body.date ? new Date(req.body.date) : new Date();
  start.setHours(0,0,0,0);
  const mode = (req.body && req.body.mode) || 'normal';
  const days = Math.min(7, Math.max(1, Number(req.body && req.body.days) || 7));

  const household = await Household.findById(req.user.householdId);
  const profile = await TasteProfile.findOne({ householdId: req.user.householdId }) || await TasteProfile.create({ householdId: req.user.householdId });
  const dishes = await Dish.find().lean();
  const ingredients = await Ingredient.find().select('name category').lean();
  const ingredientMap = new Map(ingredients.map(i => [String(i._id), i]));
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const inventoryIds = new Set(inventory.filter(i => !i.expiresAt || new Date(i.expiresAt) >= new Date()).map(i => String(i.ingredientId)));
  const recentFb = await Feedback.find({ householdId: req.user.householdId }).sort({ createdAt: -1 }).limit(20).lean();
  const weather = await getWeather(household && household.region && household.region.lat, household && household.region && household.region.lng);

  const dishById = new Map(dishes.map(d => [String(d._id), d]));
  const baseExclude = new Set([
    ...recentFb.map(f => String(f.dishId)),
    ...(profile.recentDishIds || []).map(String)
  ]);

  const baseArgs = {
    dishes,
    profile,
    household: household || { members: [], cuisineMode: 'mixed' },
    weather,
    inventoryIds,
    mode,
    ingredientMap
  };

  const weekDishIds = new Set();            // all dishes used anywhere this week
  const usedBySlot = {};                    // slot -> array of { day, dishId }
  for (const slot of ALL_SLOTS) usedBySlot[slot] = [];

  const daysOut = [];
  const touchedIds = [];

  for (let day = 0; day < days; day++) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    date.setHours(0,0,0,0);

    const usedDishIds = [];
    const usedCuisines = [];
    const slots = {};

    for (const slot of ALL_SLOTS) {
      const slotHistory = usedBySlot[slot];
      const recentForSlot = slotHistory.filter(u => day - u.day < 3).map(u => u.dishId);

      const tiers = [
        [...baseExclude, ...weekDishIds],          // nothing repeated anywhere
        [...baseExclude, ...recentForSlot],        // allow >3-day-old repeats
        []                                          // last resort
      ];

      let rec = null;
      for (const tier of tiers) {
        rec = recommendForSlot({
          ...baseArgs,
          slot,
          recentDishIds: [...new Set(tier)].map(String),
          recentCuisines: usedCuisines
        });
        if (rec) break;
      }
      if (!rec) continue;

      const dishId = String(rec.dish._id);
      weekDishIds.add(dishId);
      usedDishIds.push(dishId);
      usedCuisines.push(rec.dish.cuisine);
      usedBySlot[slot].push({ day, dishId });
      touchedIds.push(rec.dish._id);

      slots[slot] = {
        dishId: rec.dish._id,
        status: 'suggested',
        explanation: { reasons: rec.reasons, scoreBreakdown: rec.breakdown },
        generatedBy: rec.generatedBy,
        servings: 2
      };
    }

    const plan = await MealPlan.findOneAndUpdate(
      { householdId: req.user.householdId, date },
      { householdId: req.user.householdId, date, slots, planType: 'week' },
      { upsert: true, new: true }
    ).populate('slots.breakfast.dishId slots.lunch.dishId slots.snack.dishId slots.dinner.dishId');
    daysOut.push(plan);
  }

  if (touchedIds.length) {
    await TasteProfile.updateOne(
      { householdId: req.user.householdId },
      { $push: { recentDishIds: { $each: touchedIds, $slice: -16 } } }
    );
  }

  const uniqueCount = new Set(touchedIds.map(String)).size;
  res.json({
    days: daysOut,
    uniqueDishes: uniqueCount,
    totalMeals: touchedIds.length
  });
}));

router.patch('/:date/:slot/status', asyncHandler(async (req,res)=>{
  const dateStr = new Date(req.params.date);
  dateStr.setHours(0,0,0,0);
  const slot = req.params.slot;
  const status = req.body.status;
  const plan = await MealPlan.findOne({ householdId: req.user.householdId, date: dateStr });
  if (!plan || !plan.slots[slot]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Slot not found' } });
  plan.slots[slot].status = status;
  await plan.save();
  res.json(plan);
}));

export default router;
