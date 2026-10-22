import { app } from './app.js';
import { connectDB, isDbConnected } from './config/db.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log('SwaadCart API running on', env.PORT);
  console.log('[startup] mongo status:', isDbConnected() ? 'connected' : 'connecting in background');
  connectDB();
});
