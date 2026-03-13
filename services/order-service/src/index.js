const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'order-service', status: 'ok', timestamp: new Date() });
});

app.get('/api/orders', (req, res) => {
  res.json({ message: 'Order Service running. Full implementation Day 4.' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`[Order Service] Port ${PORT}`));
