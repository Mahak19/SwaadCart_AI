import mongoose from 'mongoose';

const invSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantity: { type: Number, required: true, min: 0 },
  purchasedAt: Date,
  expiresAt: Date,
  source: { type: String, enum: ['purchase','manual','cooked-adjustment'], default: 'manual' }
}, { timestamps: true });

invSchema.index({ householdId: 1, ingredientId: 1 });
invSchema.index({ householdId: 1, expiresAt: 1 });

export default mongoose.model('InventoryItem', invSchema);
