const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

// Static files at project root
app.use(express.static(ROOT, { extensions: ['html'] }));

// Explicit routes (clean URLs)
const routes = {
  '/':          'index.html',
  '/attijari':  'attijari.html',
  '/cih':       'cih.html',
  '/wafacash':  'wafacash.html',
  '/wave':      'wave.html',
  '/cash-express': 'cash-express.html',
};
for (const [url, file] of Object.entries(routes)) {
  app.get(url, (_req, res) => res.sendFile(path.join(ROOT, file)));
}

// 404 fallback
app.use((_req, res) => res.status(404).sendFile(path.join(ROOT, 'index.html')));

app.listen(PORT, () => console.log('PayZone Afrique listening on ' + PORT));
