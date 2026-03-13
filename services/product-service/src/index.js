const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'product-service', status: 'ok', timestamp: new Date() });
});

app.get('/api/products', (req, res) => {
  res.json({ message: 'Product Service running. Full implementation Day 3.' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`[Product Service] Port ${PORT}`));
