import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getWeather } from '../services/weather.service.js';
import Household from '../models/Household.js';

const router = Router();
router.use(auth, householdScope);

router.get('/current', asyncHandler(async (req,res)=>{
  const h = await Household.findById(req.user.householdId);
  const w = await getWeather(h?.region?.lat, h?.region?.lng);
  res.json(w);
}));

export default router;
