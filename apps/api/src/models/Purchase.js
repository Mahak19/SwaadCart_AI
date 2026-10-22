import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
  qty: Number,
  priceINR: Number
});

const purchaseSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  date: { type: Date, default: Date.now },
  store: String,
  items: [itemSchema],
  totalINR: Number
}, { timestamps: true });

purchaseSchema.index({ householdId: 1, date: -1 });

export default mongoose.model('Purchase', purchaseSchema);
