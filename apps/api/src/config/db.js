import mongoose from 'mongoose';
import { env } from './env.js';

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// The API must stay alive even when MongoDB is briefly unreachable, otherwise
// the container crash-loops on Render and the real reason stays hidden in the
// logs. Connection is retried in the background instead.
export async function connectDB({ retries = 6, delayMs = 5000 } = {}) {
  mongoose.connection.on('connected', () => console.log('[db] mongo connected'));
  mongoose.connection.on('error', err => console.error('[db] mongo error:', err.message));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        console.error('[db] giving up for now, API keeps serving and will retry on the next request');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}
