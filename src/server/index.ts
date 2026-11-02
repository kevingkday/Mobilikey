import { Hono } from 'hono';
import { createDb, type AppContext } from './env';
import { sessionMiddleware } from './middleware/auth';
import { csrfMiddleware } from './middleware/csrf';
import { authRoutes } from './routes/auth.routes';
import { usersRoutes } from './routes/users.routes';
import { companiesRoutes } from './routes/companies.routes';
import { messagesRoutes } from './routes/messages.routes';
import { announcementsRoutes } from './routes/announcements.routes';
import { searchRoutes } from './routes/search.routes';
import { notificationsRoutes } from './routes/notifications.routes';
import { adminRoutes } from './routes/admin.routes';

const app = new Hono<AppContext>();

// Attach Drizzle D1 instance and session/CSRF middleware to all /api/* routes
app.use('/api/*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  return next();
});

app.use('/api/*', sessionMiddleware);
app.use('/api/*', csrfMiddleware);

app.get('/api/health', (c) => {
  return c.json({
    service: 'mobilikey-api',
    status: 'ok',
    tagline: 'Earn access. Build connections.',
    timestamp: Date.now(),
  });
});

app.route('/api/auth', authRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/companies', companiesRoutes);
app.route('/api/messages', messagesRoutes);
app.route('/api/announcements', announcementsRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/notifications', notificationsRoutes);
app.route('/api/admin', adminRoutes);

// Fallback for unknown API routes
app.all('/api/*', (c) => {
  return c.json({ error: 'API endpoint not found' }, 404);
});

// Serve static SPA assets when deployed to Cloudflare Workers
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Mobilikey Worker API is running.', 200);
});

export default app;

