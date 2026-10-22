import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Household from '../models/Household.js';
import GroceryList from '../models/GroceryList.js';
import { startOfWeek } from '../utils/dateHelpers.js';

const router = Router();
router.use(auth, householdScope);

router.put('/budget', asyncHandler(async (req, res) => {
  const budget = Number(req.body && req.body.weeklyBudgetINR);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 100000) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid budget' } });
  }
  const household = await Household.findByIdAndUpdate(
    req.user.householdId,
    { weeklyBudgetINR: budget },
    { new: true }
  );
  const weekStart = startOfWeek();
  const grocery = await GroceryList.findOne({ householdId: req.user.householdId, weekStart });
  let budgetAdjusted = false;
  if (grocery && grocery.estimatedTotalINR > budget) {
    grocery.budgetAdjusted = true;
    grocery.changeLog.push({ at: new Date(), message: 'Budget lowered to ' + budget + ', list flagged for review' });
    await grocery.save();
    budgetAdjusted = true;
  }
  res.json({ household, budgetAdjusted });
}));

export default router;
