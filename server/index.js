require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const db = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const rateLimiters = require('./middlewares/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const configRoutes = require('./routes/config');
const registrationRoutes = require('./routes/registration');
const notificationRoutes = require('./routes/notifications');
const couponRoutes = require('./routes/coupons');
const packageRoutes = require('./routes/packages');

// Import scheduler
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Setup Wizard Logic (Must be before static files)
if (!process.env.SETUP_COMPLETED) {
  logger.info('Setup not completed. Serving Setup Wizard.');
  
  // Setup Routes
  app.use('/api/setup', require('./routes/setup'));
  
  // Serve static files needed for setup (css, js)
  app.use(express.static(path.join(__dirname, '../public')));

  // Force redirect to setup.html for ANY other request
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/setup.html'));
  });
} else {
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));

  // Clean URLs for frontend pages
  app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/user_login.html'));
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin_login.html'));
  });

  app.get('/registration', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/registration.html'));
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/registration', registrationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/coupons', couponRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/form-fields', require('./routes/formFields'));
}

// Error handler (must be last)
app.use(errorHandler);

// Start scheduler
scheduler.start();

// Start server
app.listen(PORT, () => {
  logger.info(`Rflix-API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  scheduler.stop();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  scheduler.stop();
  db.close();
  process.exit(0);
});
