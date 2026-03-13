const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'recommendation-service', status: 'ok', timestamp: new Date() });
});

app.get('/api/recommendations', (req, res) => {
  res.json({ message: 'Recommendation Service running. Full implementation Day 6.' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`[Recommendation Service] Port ${PORT}`));
