import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import InventoryItem from '../models/InventoryItem.js';

const router = Router();
router.use(auth, householdScope);

router.get('/', asyncHandler(async (req,res)=>{
  const items = await InventoryItem.find({ householdId: req.user.householdId }).populate('ingredientId');
  res.json(items);
}));

router.post('/', asyncHandler(async (req,res)=>{
  const item = await InventoryItem.create({ ...req.body, householdId: req.user.householdId });
  res.json(item);
}));

router.patch('/:id', asyncHandler(async (req,res)=>{
  const item = await InventoryItem.findOneAndUpdate({ _id: req.params.id, householdId: req.user.householdId }, req.body, { new: true });
  res.json(item);
}));

router.delete('/:id', asyncHandler(async (req,res)=>{
  await InventoryItem.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId });
  res.json({ ok: true });
}));

export default router;
