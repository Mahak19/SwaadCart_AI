import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hybridSearch } from '../services/search.service.js';

const router = Router();

router.get('/', auth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (q.length < 2) {
    return res.json({ query: q, local: { ingredients: [], dishes: [] }, external: [], ai: null, aiEnabled: Boolean(process.env.OPENAI_API_KEY) });
  }
  const result = await hybridSearch(q);
  res.json(result);
}));

export default router;
