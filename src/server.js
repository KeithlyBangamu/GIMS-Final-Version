import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import { bootstrapHardcodedAdmins } from './config/bootstrapAccounts.js';
import adminRoutes from './routes/admin.js';
import employeeRoutes from './routes/employee.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Force authenticated dashboard pages to revalidate every navigation (including
// browser Back/Forward) so a logged-out user can't see a cached dashboard.
app.use((req, res, next) => {
  const accept = String(req.headers.accept || '');
  const isHtmlNav =
    req.method === 'GET' &&
    (accept.includes('text/html') || /\.html?$/.test(req.path));
  if (isHtmlNav) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    if (/\.html?$/.test(filePath)) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  },
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GIMS API running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const start = async () => {
  try {
    await connectDB();
    await bootstrapHardcodedAdmins();
    app.listen(PORT, () => {
      console.log(`GIMS server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
};

start();
