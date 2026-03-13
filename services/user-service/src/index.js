require('dotenv').config();
const express = require('express');
const migrate = require('./migrate');
const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'ok', timestamp: new Date() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes); // /api/users also maps here for admin route

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[User Service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

// Run DB migration first, then start server
migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[User Service] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[User Service] Failed to start:', err);
    process.exit(1);
  });
