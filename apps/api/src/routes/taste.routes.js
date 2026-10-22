import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import TasteProfile from '../models/TasteProfile.js';

const router = Router();
router.use(auth, householdScope);

function buildSummary(profile) {
  return {
    spiceTarget: profile.spiceTarget,
    oilTarget: profile.oilTarget,
    weightPref: profile.weightPref,
    feedbackCount: profile.feedbackCount,
    explorationRate: profile.explorationRate,
    topCuisines: [...(profile.cuisineWeights && typeof profile.cuisineWeights.entries === 'function'
      ? [...profile.cuisineWeights.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>({cuisine:e[0],weight:e[1]}))
      : [])],
    neverDishIds: profile.neverDishIds,
    learningLog: (profile.learningLog||[]).slice(-20).reverse()
  };
}

router.get('/profile', asyncHandler(async (req,res)=>{
  let profile = await TasteProfile.findOne({ householdId: req.user.householdId });
  if (!profile) profile = await TasteProfile.create({ householdId: req.user.householdId });
  res.json(buildSummary(profile));
}));

const patchSchema = z.object({
  spiceTarget: z.number().int().min(1).max(5).optional(),
  oilTarget: z.number().int().min(1).max(5).optional()
});

router.patch('/profile', asyncHandler(async (req,res)=>{
  const parsed = patchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Spice and oil preferences must be between 1 and 5' } });
  }
  const update = {};
  if (parsed.data.spiceTarget != null) update.spiceTarget = parsed.data.spiceTarget;
  if (parsed.data.oilTarget != null) update.oilTarget = parsed.data.oilTarget;
  update.updatedAt = new Date();

  const profile = await TasteProfile.findOneAndUpdate(
    { householdId: req.user.householdId },
    { $set: update, $setOnInsert: { householdId: req.user.householdId } },
    { upsert: true, new: true }
  );
  res.json(buildSummary(profile));
}));

router.post('/reset', asyncHandler(async (req,res)=>{
  await TasteProfile.findOneAndDelete({ householdId: req.user.householdId });
  res.json({ ok: true });
}));

export default router;
