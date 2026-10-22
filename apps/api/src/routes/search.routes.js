import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hybridSearch, searchAIAnswer } from '../services/search.service.js';
import { aiEnabled } from '../services/ai.service.js';

const router = Router();

router.get('/', auth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (q.length < 2) {
    return res.json({ query: q, local: { ingredients: [], dishes: [] }, external: [], ai: null, aiEnabled: aiEnabled() });
  }
  const result = await hybridSearch(q, { withAi: req.query.ai !== '0' });
  res.json(result);
}));

router.get('/ai', auth, asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (q.length < 2) return res.json({ ai: null, aiEnabled: aiEnabled() });
  const ai = await searchAIAnswer(q);
  res.json({ ai, aiEnabled: aiEnabled() });
}));

export default router;
