import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { householdScope } from '../middleware/householdScope.js';
import Household from '../models/Household.js';
import TasteProfile from '../models/TasteProfile.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccess } from '../utils/tokens.js';

const router = Router();

router.use(auth);

// Onboarding must work before a household exists for newly registered users.
router.put('/onboarding', asyncHandler(async (req, res) => {
  const { city, state, weeklyBudgetINR, members, spiceTarget, oilTarget } = req.body;
  const mappedMembers = Array.isArray(members) && members.length
    ? members.map(m => ({
        name: m.name || 'Member',
        ageGroup: m.ageGroup || 'adult',
        diet: m.diet || 'veg',
        spiceLevel: m.spiceLevel ?? spiceTarget ?? 3,
        oilLevel: m.oilLevel ?? oilTarget ?? 3,
        allergies: m.allergies || []
      }))
    : [];

  let household;
  if (req.user.householdId) {
    household = await Household.findByIdAndUpdate(req.user.householdId, {
      ...(weeklyBudgetINR != null && { weeklyBudgetINR }),
      ...(city && { 'region.city': city }),
      ...(state && { 'region.state': state }),
      ...(mappedMembers.length && { members: mappedMembers })
    }, { new: true });
  }

  if (!household) {
    household = await Household.create({
      name: (mappedMembers[0] && mappedMembers[0].name ? mappedMembers[0].name + "'s Kitchen" : 'My Kitchen'),
      ownerId: req.user.id,
      weeklyBudgetINR: weeklyBudgetINR ?? 3000,
      region: { city: city || 'Delhi', state: state || 'Delhi' },
      members: mappedMembers.length ? mappedMembers : [{ name: 'Me', ageGroup: 'adult', diet: 'veg' }]
    });
  }

  await TasteProfile.findOneAndUpdate(
    { householdId: household._id },
    {
      spiceTarget: spiceTarget ?? 3,
      oilTarget: oilTarget ?? 3,
      $setOnInsert: { householdId: household._id }
    },
    { upsert: true, new: true }
  );

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { householdId: household._id, onboardingComplete: true },
    { new: true }
  );

  // Re-issue the access token so it carries the new householdId.
  res.cookie('accessToken', signAccess(user), { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production' });

  res.json({
    household,
    onboardingComplete: user.onboardingComplete,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      householdId: user.householdId,
      onboardingComplete: user.onboardingComplete
    }
  });
}));

router.use(householdScope);

router.get('/', asyncHandler(async (req, res) => {
  const h = await Household.findById(req.user.householdId);
  res.json(h);
}));

router.put('/', asyncHandler(async (req, res) => {
  const h = await Household.findByIdAndUpdate(req.user.householdId, req.body, { new: true });
  res.json(h);
}));

export default router;
