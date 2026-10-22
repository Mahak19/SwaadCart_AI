import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  const conn = await mongoose.connect(env.MONGODB_URI);
  return conn;
}
