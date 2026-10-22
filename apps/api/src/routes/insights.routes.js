import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import InventoryItem from '../models/InventoryItem.js';
import Ingredient from '../models/Ingredient.js';
import { getSuggestions } from '../services/insights.service.js';

const router = Router();
router.use(auth, householdScope);

router.get('/suggestions', asyncHandler(async (req, res) => {
  const inventory = await InventoryItem.find({ householdId: req.user.householdId }).lean();
  const ingredientCatalog = await Ingredient.find().lean();
  const suggestions = await getSuggestions(req.user.householdId, inventory, ingredientCatalog);
  res.json({ suggestions });
}));

export default router;
