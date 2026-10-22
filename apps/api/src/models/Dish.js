import mongoose from 'mongoose';

const ingSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
  qtyPerServing: Number,
  essential: { type: Boolean, default: true }
});

const dishSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameHi: String,
  imageUrl: String,
  slots: [{ type: String, enum: ['breakfast','lunch','snack','dinner'] }],
  diet: { type: String, enum: ['veg','eggetarian','nonveg'], required: true },
  cuisine: String,
  regionTags: [String],
  spice: { type: Number, min: 1, max: 5 },
  oil: { type: Number, min: 1, max: 5 },
  weight: { type: String, enum: ['light','medium','heavy'] },
  weatherFit: [{ type: String, enum: ['hot','humid','mild','cool','rainy'] }],
  ingredients: [ingSchema],
  tags: [String],
  prepMinutes: Number,
  caloriesApprox: Number,
  steps: [String],
  estimatedCostPerServingINR: Number,
  isSeasonal: { type: Boolean, default: false },
  season: [String]
}, { timestamps: true });

export default mongoose.model('Dish', dishSchema);
