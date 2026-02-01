const express = require('express');
const cors = require('cors');
const { loadEnv, validateEnv } = require('./config/env.cjs');

loadEnv();
validateEnv();

const dbRoutes = require('./routes/db.cjs');
const healthRoutes = require('./routes/health.cjs');
const reportsRoutes = require('./routes/reports.cjs');
const llmRoutes = require('./routes/llm.cjs');
const shopifyRoutes = require('./routes/shopify.cjs');
const semanticRoutes = require('./routes/semantic.cjs');
const errorRoutes = require('./routes/errors.cjs');
const usageRoutes = require('./routes/usage.cjs');
const { attachUser } = require('./middleware/auth.cjs');
const authRoutes = require('./routes/auth.cjs');
const meRoutes = require('./routes/me.cjs');
const connectorsRoutes = require('./routes/connectors.cjs');
const capabilityRoutes = require('./routes/capabilities.cjs');
const billingRoutes = require('./routes/billing.cjs');
const { createRateLimiter, keyByIp, keyByUserOrg } = require('./middleware/rateLimit.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingRoutes.handleStripeWebhook);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(attachUser);

const authLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_AUTH || '20', 10),
  keyGenerator: keyByIp,
  skip: (req) => !req.path.startsWith('/auth')
});

const generalLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_GENERAL || '120', 10),
  keyGenerator: keyByUserOrg,
  skip: (req) => req.path.startsWith('/health') || req.path.startsWith('/auth')
});

const llmLimiter = createRateLimiter({
  windowMs: parseInt(process.env.LLM_RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.LLM_RATE_LIMIT_MAX || '30', 10),
  keyGenerator: keyByUserOrg,
  skip: (req) => !(
    req.path.startsWith('/chat') ||
    req.path.startsWith('/generate-dashboard') ||
    req.path.startsWith('/dashboard-chat') ||
    req.path.startsWith('/regenerate-widget') ||
    req.path.startsWith('/multiturn-chat')
  )
});

app.use('/api', authLimiter);
app.use('/api', generalLimiter);
app.use('/api', llmLimiter);

app.use('/api', dbRoutes);
app.use('/api', llmRoutes);
app.use('/api', healthRoutes);
app.use('/api', reportsRoutes);
app.use('/api', shopifyRoutes);
app.use('/api', semanticRoutes);
app.use('/api', errorRoutes);
app.use('/api', usageRoutes);
app.use('/api', authRoutes);
app.use('/api', meRoutes);
app.use('/api', connectorsRoutes);
app.use('/api', capabilityRoutes);
app.use('/api', billingRoutes.router);

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
