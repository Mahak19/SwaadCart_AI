import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import Ingredient from '../models/Ingredient.js';
import Dish from '../models/Dish.js';

const router = Router();

router.get('/ingredients', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const filter = q ? { name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
  const ingredients = await Ingredient.find(filter).limit(50).lean();
  res.json(ingredients);
}));

router.get('/dishes', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.diet) filter.diet = req.query.diet;
  if (req.query.cuisine) filter.cuisine = req.query.cuisine;
  if (req.query.slot) filter.slots = req.query.slot;
  const dishes = await Dish.find(filter).limit(100).lean();
  res.json(dishes);
}));

router.get('/dishes/:id', asyncHandler(async (req, res) => {
  const dish = await Dish.findById(req.params.id)
    .populate('ingredients.ingredientId', 'name nameHi baseUnit avgPricePerBaseUnitINR category')
    .lean();
  if (!dish) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dish not found' } });
  }
  res.json(dish);
}));

export default router;

