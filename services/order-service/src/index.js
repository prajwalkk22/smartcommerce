require('dotenv').config();
const express = require('express');
const migrate = require('./migrate');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'order-service', status: 'ok', timestamp: new Date() });
});

app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[Order Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3003;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Order Service] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Order Service] Failed to start:', err);
    process.exit(1);
  });
