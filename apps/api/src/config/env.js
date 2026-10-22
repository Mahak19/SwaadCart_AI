import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  WEATHER_CACHE_TTL_MIN: z.coerce.number().default(30),
  LOG_LEVEL: z.enum(['info','debug','error']).default('info'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  YOUTUBE_API_KEY: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map(i => `${i.path.join('.')} (${i.message})`)
    .join(', ');
  console.error('[config] Invalid environment configuration -> ' + issues);
  console.error('[config] Required on Render: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET');
  process.exit(1);
}

export const env = parsed.data;
