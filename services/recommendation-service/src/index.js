require('dotenv').config();
const express = require('express');
const migrate = require('./migrate');
const recommendationRoutes = require('./routes/recommendations');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'recommendation-service', status: 'ok', timestamp: new Date() });
});

app.use('/api/recommendations', recommendationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('[Recommendation Service] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3004;

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Recommendation Service] Running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Recommendation Service] Failed to start:', err);
    process.exit(1);
  });
