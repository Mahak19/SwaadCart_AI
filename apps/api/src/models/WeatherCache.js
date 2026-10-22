import mongoose from 'mongoose';

const weatherSchema = new mongoose.Schema({
  key: { type: String, required: true },
  data: Object,
  fetchedAt: { type: Date, default: Date.now }
}, { expireAfterSeconds: 1800 });

export default mongoose.model('WeatherCache', weatherSchema);
