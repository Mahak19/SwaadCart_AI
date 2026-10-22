import mongoose from 'mongoose';

const packSchema = new mongoose.Schema({
  qty: Number,
  priceINR: Number
});

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameHi: String,
  aliases: [String],
  category: { type: String, enum: ['grain','pulse','protein','vegetable','fruit','dairy','spice','oil','other'], required: true },
  baseUnit: { type: String, enum: ['g','ml','pcs'], required: true },
  packSizes: [packSchema],
  avgPricePerBaseUnitINR: Number,
  shelfLifeDays: Number,
  substitutes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' }],
  isStaple: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Ingredient', ingredientSchema);
