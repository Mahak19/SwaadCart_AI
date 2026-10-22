import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Feedback from '../models/Feedback.js';
import TasteProfile from '../models/TasteProfile.js';
import Dish from '../models/Dish.js';
import GroceryList from '../models/GroceryList.js';
import { applyFeedback, applyTimeDecay } from '../services/mealmind/learner.js';
import { startOfWeek } from '../utils/dateHelpers.js';

const router = Router();
router.use(auth, householdScope);

router.post('/', asyncHandler(async (req,res)=>{
  const { dishId, slot, action, reasons = [], ingredientBlamed } = req.body;
  const dish = dishId ? await Dish.findById(dishId).lean() : null;
  let profile = await TasteProfile.findOne({ householdId: req.user.householdId });
  if (!profile) profile = await TasteProfile.create({ householdId: req.user.householdId });
  applyTimeDecay(profile);
  const log = applyFeedback(profile, { dish, action, reasons, slot, ingredientBlamed });
  await profile.save();

  const weekStart = startOfWeek();
  const grocery = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  let groceryDiff = { added: [], removed: [] };
  if (action === 'never' && dish) {
    if (grocery) {
      const before = grocery.items.length;
      grocery.items = grocery.items.filter(it => !(it.linkedDishIds || []).map(String).includes(String(dishId)));
      groceryDiff.removed = grocery.items.length < before ? ['Removed items no longer needed'] : [];
      grocery.changeLog.push({ at: new Date(), message: 'Removed items linked to ' + (dish?.name || 'a dish') + ' after feedback' });
      await grocery.save();
    }
  }

  const learned = log.length ? log[log.length - 1] : { message: 'Noted', delta: action };
  res.json({ learned, groceryDiff });
}));

export default router;
