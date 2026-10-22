import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Ingredient from '../models/Ingredient.js';
import Household from '../models/Household.js';
import TasteProfile from '../models/TasteProfile.js';
import Dish from '../models/Dish.js';
import { cookWithWhatIHave } from '../services/mealmind/cookWithWhatIHave.js';

const router = Router();
router.use(auth, householdScope);

router.post('/', asyncHandler(async (req, res) => {
  const raw = (req.body && req.body.ingredients) || '';
  const input = Array.isArray(raw) ? raw.join(', ') : String(raw);
  if (!input.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'List what you have' } });
  }
  const [catalog, dishes, household, profile] = await Promise.all([
    Ingredient.find().lean(),
    Dish.find().lean(),
    Household.findById(req.user.householdId),
    TasteProfile.findOne({ householdId: req.user.householdId })
  ]);
  const result = await cookWithWhatIHave(input, catalog, profile, household, dishes);
  res.json(result);
}));

export default router;
