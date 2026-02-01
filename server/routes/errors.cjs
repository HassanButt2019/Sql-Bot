const express = require('express');

const router = express.Router();

const errorBuffer = [];
const MAX_ERRORS = 200;

router.post('/client-error', (req, res) => {
  const { message, stack, source, userAgent, url, meta } = req.body || {};
  const entry = {
    message,
    stack,
    source,
    userAgent,
    url,
    meta,
    at: Date.now()
  };
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.shift();
  }
  console.error('Client error:', entry);
  res.json({ success: true });
});

router.get('/client-error', (_req, res) => {
  res.json({ success: true, data: errorBuffer });
});

module.exports = router;
