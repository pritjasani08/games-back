const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// health check route
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// test route
app.get('/api/apps', (req, res) => {
  res.json([{ name: "test app" }]);
});

module.exports = (req, res) => app(req, res);
