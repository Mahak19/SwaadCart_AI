import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  dishId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
  slot: { type: String, enum: ['breakfast','lunch','snack','dinner'] },
  action: { type: String, enum: ['love','like','okay','dislike','never'], required: true },
  reasons: [String],
  ingredientBlamed: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
  context: {
    weatherBucket: String,
    tempC: Number,
    cuisineMode: String,
    appetite: String,
    energy: String
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

feedbackSchema.index({ householdId: 1, createdAt: -1 });

export default mongoose.model('Feedback', feedbackSchema);
