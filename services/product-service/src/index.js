require('dotenv').config();
const express = require('express');
const migrate = require('./migrate');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'product-service', status: 'ok', timestamp: new Date() });
});

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[Product Service] Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3002;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Product Service] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Product Service] Failed to start:', err);
    process.exit(1);
  });
