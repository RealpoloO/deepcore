import express from 'express';
import cors from 'cors';
import session from 'express-session';
import BetterSqlite3Store from 'better-sqlite3-session-store';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/characters.js';
import miningRoutes from './routes/mining.js';
import industryRoutes from './routes/industry.js';
import discordRoutes from './routes/discord.js';
import marketRoutes from './routes/market.js';
import productionPlannerRoutes from './routes/productionPlanner.js';
import { initDatabase } from './database/init.js';
import logger from './utils/logger.js';
import { generalLimiter } from './middleware/rateLimiter.js';

// Load environment-specific config
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });
import jobAlertService from './services/jobAlerts.js';
import marketService from './services/market.js';
import sdeService from './services/sde.js';
import blueprintService from './services/blueprintService.js';
import sdeManager from './services/sdeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true
}));

app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', generalLimiter);

// Session configuration with persistent store
const SqliteStore = BetterSqlite3Store(session);
const sessionDb = new Database(path.join(__dirname, '../data/sessions.db'));
app.use(session({
  store: new SqliteStore({
    client: sessionDb,
    expired: {
      clear: true,
      intervalMs: 900000 // 15 minutes
    }
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/industry', industryRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/production-planner', productionPlannerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'WhatDidIMine API is running' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();

    // Load SDE types into memory
    await sdeService.loadTypes();

    // Load blueprints into memory
    await blueprintService.loadBlueprints();

    // Start job alert service
    jobAlertService.start();

    // Start market price sync service
    marketService.start();

    // Start SDE update scheduler
    logger.info('📅 Starting SDE update scheduler...');
    sdeManager.startScheduler();

    // Initial SDE update check (non-blocking)
    sdeManager.checkForUpdates(true).catch(err =>
      logger.warn('Initial SDE check failed:', err.message)
    );

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  jobAlertService.stop();
  marketService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  jobAlertService.stop();
  marketService.stop();
  process.exit(0);
});

startServer();
