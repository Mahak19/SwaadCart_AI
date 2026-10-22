import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household' },
  onboardingComplete: { type: Boolean, default: false },
  region: {
    state: String,
    city: String,
    lat: Number,
    lng: Number
  },
  cuisineMode: { type: String, enum: ['local','mixed','explore'], default: 'mixed' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model('User', userSchema);
