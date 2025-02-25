require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const errorHandler = require('./middleware/errorHandler');

// Import route files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const escrowRoutes = require('./routes/escrowRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Import database configuration
const connectDB = require('./config/db');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Import passport config
require('./config/passport')(passport);

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method')); // For HTTP methods like PUT, DELETE in forms
app.use(cors());
app.use(morgan('dev')); // Logging
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_fallback_session_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: 60 * 60 * 24 // Session TTL (1 day)
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // Cookie expiry (1 day)
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Route setup
app.use('/', authRoutes);
app.use('/users', userRoutes);
app.use('/escrow', escrowRoutes);
app.use('/payments', paymentRoutes);

// Home route - redirect to dashboard if logged in, otherwise show landing page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { 
    title: 'Secure B2B Escrow Platform',
    description: 'A secure platform for B2B transactions with escrow protection'
  });
});

// Dashboard route (protected)
app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    // You might want to fetch some data here for the dashboard
    // For example: active escrows, recent transactions, etc.
    res.render('dashboard', {
      title: 'Dashboard',
      user: req.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'An error occurred while loading the dashboard');
    res.redirect('/');
  }
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this resource');
  res.redirect('/login');
}

// 404 route - catch-all for undefined routes
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you requested does not exist',
    statusCode: 404
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;