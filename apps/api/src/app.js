import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import householdRoutes from './routes/household.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import groceryRoutes from './routes/grocery.routes.js';
import mealsRoutes from './routes/meals.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import tasteRoutes from './routes/taste.routes.js';
import weatherRoutes from './routes/weather.routes.js';
import cookRoutes from './routes/cook.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import budgetRoutes from './routes/budget.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import searchRoutes from './routes/search.routes.js';
import discoverRoutes from './routes/discover.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();
const logger = pino({ level: env.LOG_LEVEL });

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(hpp());
app.use(mongoSanitize());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/v1/auth', authLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/household', householdRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/grocery', groceryRoutes);
app.use('/api/v1/meals', mealsRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/taste', tasteRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/cook', cookRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/budget', budgetRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/discover', discoverRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
