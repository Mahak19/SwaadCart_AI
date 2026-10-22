import mongoose from 'mongoose';

const gItem = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  qty: Number,
  unit: String,
  packSuggestion: String,
  estPriceINR: Number,
  reasons: [String],
  linkedDishIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }],
  unlocksCount: Number,
  checked: { type: Boolean, default: false },
  addedBy: { type: String, enum: ['ai','user'], default: 'ai' }
}, { _id: true });

const grocerySchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  weekStart: Date,
  budgetINR: Number,
  estimatedTotalINR: Number,
  items: [gItem],
  generatedAt: Date,
  version: { type: Number, default: 1 },
  changeLog: [{ at: Date, message: String }]
}, { timestamps: true });

grocerySchema.index({ householdId: 1, weekStart: 1 });

export default mongoose.model('GroceryList', grocerySchema);
