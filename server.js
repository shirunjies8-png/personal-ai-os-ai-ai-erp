const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
require('./database/init');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const publicDir = path.join(process.cwd(), 'public');

app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(env.uploadsDir));
app.use('/api', apiRoutes);

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexFile = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    return res.status(503).send('Frontend assets are not synced. Run npm start or npm run build again.');
  }
  return res.sendFile(indexFile);
});

app.use(errorHandler);

app.listen(env.port, env.host, () => {
  console.log(`Personal AI OS server running on ${env.appUrl}`);
});
