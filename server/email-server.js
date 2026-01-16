require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'fotonix-email-api' });
});

// Email routes - ONLY the webhook receiver
const emailReceiveWebhook = require('./routes/email/receive-webhook');
const emailRoutes = require('./routes/email/emails');

app.use('/api/email', emailReceiveWebhook);
app.use('/api/email', emailRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Email API server running on port ${PORT}`);
});
