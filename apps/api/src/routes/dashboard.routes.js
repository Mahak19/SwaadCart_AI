import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Household from '../models/Household.js';
import User from '../models/User.js';
import GroceryList from '../models/GroceryList.js';
import MealPlan from '../models/MealPlan.js';
import InventoryItem from '../models/InventoryItem.js';
import Feedback from '../models/Feedback.js';
import TasteProfile from '../models/TasteProfile.js';
import Dish from '../models/Dish.js';
import { recommendDay } from '../services/mealmind/recommender.js';
import { getWeather } from '../services/weather.service.js';
import { startOfWeek, daysLeftInWeek } from '../utils/dateHelpers.js';

const router = Router();
router.use(auth, householdScope);

router.get('/stats', asyncHandler(async (req, res) => {
  const weekStart = startOfWeek();
  const household = await Household.findById(req.user.householdId);
  const grocery = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plan = await MealPlan.findOne({ householdId: req.user.householdId, date: today });
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const now = new Date();
  const expiringSoon = inventory.filter(i => {
    if (!i.expiresAt) return false;
    const days = (new Date(i.expiresAt) - now) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 3;
  }).length;
  const stale = inventory.filter(i => i.expiresAt && new Date(i.expiresAt) < now).length;

  const budget = (household && household.weeklyBudgetINR) || 3000;
  const spent = grocery ? grocery.estimatedTotalINR || 0 : 0;

  const planCount = plan ? Object.values(plan.slots || {}).filter(s => s && s.dishId).length : 0;

  const userDoc = await User.findById(req.user.id).select('name').lean();
  res.json({
    userName: (userDoc && userDoc.name) || '',
    budgetINR: budget,
    spentINR: spent,
    remainingINR: Math.max(0, budget - spent),
    daysLeftInWeek: daysLeftInWeek(),
    mealPlanCount: planCount,
    expiringSoonCount: expiringSoon,
    staleCount: stale,
    groceryCount: grocery ? grocery.items.length : 0
  });
}));

router.get('/meal-plan', asyncHandler(async (req, res) => {
  const household = await Household.findById(req.user.householdId);
  const profile = await TasteProfile.findOne({ householdId: req.user.householdId })
    || await TasteProfile.create({ householdId: req.user.householdId });
  const dishes = await Dish.find().lean();
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const inventoryIds = new Set(
    inventory.filter(i => !i.expiresAt || new Date(i.expiresAt) >= new Date()).map(i => String(i.ingredientId))
  );
  const recentFb = await Feedback.find({ householdId: req.user.householdId })
    .sort({ createdAt: -1 }).limit(20).lean();
  const weather = await getWeather(
    household && household.region && household.region.lat,
    household && household.region && household.region.lng
  );

  const recs = recommendDay({
    dishes,
    profile,
    household: household || { members: [], cuisineMode: 'mixed' },
    weather,
    inventoryIds,
    mode: 'normal',
    recentDishIds: recentFb.map(f => String(f.dishId))
  });

  res.json({ slots: recs, weather });
}));

router.get('/insights', asyncHandler(async (req, res) => {
  const profile = await TasteProfile.findOne({ householdId: req.user.householdId });
  const feedbackCount = profile ? profile.feedbackCount : 0;
  const log = profile && profile.learningLog ? profile.learningLog.slice(-5).reverse() : [];
  res.json({
    feedbackCount,
    learningLog: log,
    explorationRate: profile ? profile.explorationRate : 0.15
  });
}));

export default router;
