import mongoose from 'mongoose';

const rtSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedBy: String
}, { timestamps: true });

export default mongoose.model('RefreshToken', rtSchema);
