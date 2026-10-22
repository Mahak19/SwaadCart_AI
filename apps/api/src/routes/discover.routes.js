import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { discoverUniqueDishes } from '../services/discover.service.js';
import Household from '../models/Household.js';

const router = Router();

router.get('/', auth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const mood = (req.query.mood || 'all').toString().trim();
  const state = (req.query.state || req.query.region || '').toString().trim();
  const household = await Household.findById(req.user.householdId);
  const result = await discoverUniqueDishes({ q, mood, state, household });
  res.json(result);
}));

export default router;
