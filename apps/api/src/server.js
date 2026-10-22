import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

connectDB().then(() => {
  app.listen(env.PORT, () => {
    console.log('SwaadCart API running on', env.PORT);
  });
});
