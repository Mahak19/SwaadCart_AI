import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
  dishId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' },
  status: { type: String, enum: ['suggested','cooked','skipped'], default: 'suggested' },
  explanation: { reasons: [String], scoreBreakdown: Object },
  generatedBy: { type: String, enum: ['mealmind','user','surprise'], default: 'mealmind' },
  servings: { type: Number, default: 2 }
});

const mealPlanSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  date: { type: Date, required: true },
  slots: {
    breakfast: slotSchema,
    lunch: slotSchema,
    snack: slotSchema,
    dinner: slotSchema
  },
  planType: { type: String, enum: ['day','week'], default: 'day' }
}, { timestamps: true });

mealPlanSchema.index({ householdId: 1, date: 1 }, { unique: true });

export default mongoose.model('MealPlan', mealPlanSchema);
