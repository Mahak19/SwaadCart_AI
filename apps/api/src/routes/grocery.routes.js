import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import GroceryList from '../models/GroceryList.js';
import Household from '../models/Household.js';
import MealPlan from '../models/MealPlan.js';
import InventoryItem from '../models/InventoryItem.js';
import Purchase from '../models/Purchase.js';
import Ingredient from '../models/Ingredient.js';
import Dish from '../models/Dish.js';
import { planGrocery } from '../services/grocery/planner.js';
import { startOfWeek } from '../utils/dateHelpers.js';

const router = Router();
router.use(auth, householdScope);

router.get('/current', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const list = await GroceryList.findOne({ householdId: req.user.householdId, weekStart }).populate('items.ingredientId');
  res.json(list || { items: [] });
}));

router.post('/plan', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const household = await Household.findById(req.user.householdId);
  const mealPlans = await MealPlan.find({ householdId: req.user.householdId, date: { $gte: weekStart } });
  const plannedDishIds = mealPlans.flatMap(mp => Object.values(mp.slots || {}).map(s => s && s.dishId).filter(Boolean));
  const plannedDishes = await Dish.find({ _id: { $in: plannedDishIds } }).lean();
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const ingredientCatalog = await Ingredient.find().lean();
  const purchases = await Purchase.find({ householdId: req.user.householdId }).sort({ date: -1 }).limit(30).lean();

  const result = planGrocery({
    plannedDishes,
    members: household ? household.members : [],
    inventory,
    ingredientCatalog,
    purchases,
    budgetINR: (household && household.weeklyBudgetINR) || 3000
  });

  const prev = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  const diff = prev
    ? {
        added: result.items.filter(i => !(prev.items||[]).some(p => String(p.ingredientId) === String(i.ingredientId))).map(i => i.name),
        removed: (prev.items||[]).filter(p => !result.items.some(i => String(i.ingredientId) === String(p.ingredientId))).map(p => p.name)
      }
    : { added: [], removed: [] };

  const list = await GroceryList.findOneAndUpdate(
    { householdId: req.user.householdId, weekStart },
    {
      householdId: req.user.householdId,
      weekStart,
      budgetINR: (household && household.weeklyBudgetINR) || 3000,
      estimatedTotalINR: result.estimatedTotalINR,
      items: result.items,
      generatedAt: new Date(),
      version: (prev && prev.version || 0) + 1,
      $push: { changeLog: { $each: result.changeLog } }
    },
    { upsert: true, new: true }
  ).populate('items.ingredientId');

  res.json({ list, diff, notes: result.notes });
}));

router.patch('/items/:id', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const list = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  if (!list) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No list' } });
  const item = list.items.id(req.params.id);
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
  Object.assign(item, req.body);
  await list.save();
  res.json(list);
}));

router.post('/items', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const list = await GroceryList.findOneAndUpdate(
    { householdId: req.user.householdId, weekStart },
    { $push: { items: Object.assign({}, req.body, { addedBy: 'user' }) } },
    { upsert: true, new: true }
  );
  res.json(list);
}));

router.delete('/items/:id', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const list = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  if (!list) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No list' } });
  list.items.pull(req.params.id);
  await list.save();
  res.json({ ok: true });
}));

router.post('/complete', asyncHandler(async (req,res)=>{
  const weekStart = startOfWeek();
  const list = await GroceryList.findOne({ householdId: req.user.householdId, weekStart }).populate('items.ingredientId');
  if (!list) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No list' } });
  const checked = list.items.filter(i => i.checked);
  for (const item of checked) {
    const ing = item.ingredientId;
    const shelf = (ing && ing.shelfLifeDays) || 7;
    const ingId = ing && ing._id ? ing._id : item.ingredientId;
    await InventoryItem.findOneAndUpdate(
      { householdId: req.user.householdId, ingredientId: ingId },
      { quantity: (item.qty || 0), purchasedAt: new Date(), expiresAt: new Date(Date.now() + shelf*24*60*60*1000), source: 'purchase' },
      { upsert: true }
    );
  }
  await Purchase.create({
    householdId: req.user.householdId,
    store: (req.body && req.body.store) || 'local',
    items: checked.map(i => ({ ingredientId: (i.ingredientId && i.ingredientId._id) ? i.ingredientId._id : i.ingredientId, qty: i.qty, priceINR: i.estPriceINR })),
    totalINR: checked.reduce((s,i) => s + (i.estPriceINR||0), 0)
  });
  list.items = list.items.filter(i => !i.checked);
  list.changeLog.push({ at: new Date(), message: 'Shopping completed, ' + checked.length + ' items moved to pantry' });
  await list.save();
  res.json({ ok: true, moved: checked.length, list });
}));

export default router;
