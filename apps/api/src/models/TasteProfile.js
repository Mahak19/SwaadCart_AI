import mongoose from 'mongoose';

const tasteSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', unique: true },
  tagWeights: { type: Map, of: Number, default: {} },
  cuisineWeights: { type: Map, of: Number, default: {} },
  ingredientWeights: { type: Map, of: Number, default: {} },
  spiceTarget: { type: Number, min: 1, max: 5, default: 3 },
  oilTarget: { type: Number, min: 1, max: 5, default: 3 },
  weightPref: {
    breakfast: { type: Number, default: 0 },
    lunch: { type: Number, default: 0 },
    snack: { type: Number, default: 0 },
    dinner: { type: Number, default: 0 }
  },
  neverDishIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }],
  recentDishIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }],
  neverIngredientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' }],
  feedbackCount: { type: Number, default: 0 },
  explorationRate: { type: Number, default: 0.15 },
  learningLog: [{ at: Date, message: String, delta: String }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('TasteProfile', tasteSchema);
