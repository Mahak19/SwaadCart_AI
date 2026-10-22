import mongoose from 'mongoose';
import { env } from './env.js';

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// The API must stay alive even when MongoDB is briefly unreachable, otherwise
// the container crash-loops on Render and the real reason stays hidden in the
// logs. Connection is retried in the background until it succeeds.
export async function connectDB({ delayMs = 15000 } = {}) {
  mongoose.connection.on('connected', () => console.log('[db] mongo connected'));
  mongoose.connection.on('error', err => console.error('[db] mongo error:', err.message));

  let attempt = 0;
  while (mongoose.connection.readyState !== 1) {
    attempt += 1;
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      return mongoose.connection;
    } catch (err) {
      console.error(`[db] connection attempt ${attempt} failed: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return mongoose.connection;
}
