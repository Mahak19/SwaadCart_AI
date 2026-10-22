import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ageGroup: { type: String, enum: ['child','teen','adult','senior'], required: true },
  diet: { type: String, enum: ['veg','vegan','jain','sattvic','eggetarian','nonveg'], required: true },
  spiceLevel: { type: Number, min: 1, max: 5, default: 3 },
  oilLevel: { type: Number, min: 1, max: 5, default: 3 },
  allergies: [{ type: String }],
  consumptionFactor: { type: Number, default: 1.0 },
  notes: String
}, { _id: true });

const householdSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weeklyBudgetINR: { type: Number, default: 3000 },
  region: {
    state: String,
    city: String,
    lat: Number,
    lng: Number
  },
  members: [memberSchema]
}, { timestamps: true });

export default mongoose.model('Household', householdSchema);
