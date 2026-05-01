const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const studentRoutes = require('./routes/student');
const schedulingRoutes = require('./routes/scheduling');
const chatRoutes = require('./routes/chat');

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ChronoSync API is running',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', generalLimiter, adminRoutes);
app.use('/api/faculty', generalLimiter, facultyRoutes);
app.use('/api/student', generalLimiter, studentRoutes);
app.use('/api/scheduling', generalLimiter, schedulingRoutes);
app.use('/api/chat', generalLimiter, chatRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
});

module.exports = app;
