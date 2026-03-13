const { v4: uuidv4 } = require('uuid');

// Mock payment processor
// In production (Day 10) replace this with real Stripe SDK calls
// The function signature stays the same — only the internals change

async function processPayment({ amount, currency = 'usd', paymentMethod, orderId }) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simulate card decline for testing (card ending in 0000)
  if (paymentMethod && paymentMethod.endsWith('0000')) {
    return {
      success: false,
      error: 'Card declined',
      code: 'card_declined'
    };
  }

  // Simulate success
  return {
    success: true,
    payment_id: `pay_mock_${uuidv4()}`,
    amount,
    currency,
    status: 'succeeded',
    timestamp: new Date()
  };
}

module.exports = { processPayment };
