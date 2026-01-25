// Vercel Serverless Entry Point
// This is a simplified API for cloud deployment
// Containers run on client machines via client-agent
import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://pantheon-akil-hassanes-projects.vercel.app',
    'https://pantheon-pi.vercel.app',
    'https://pantheon-kappa.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'serverless',
    message: 'Backend API is running. Containers are managed by client agents.'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'serverless'
  });
});

// Placeholder routes for client-agent communication
// These will be implemented to coordinate with client agents

app.post('/api/agent/register', (req, res) => {
  const { clientId, capabilities } = req.body;
  res.json({ 
    success: true, 
    clientId,
    message: 'Client agent registered successfully' 
  });
});

app.post('/api/agent/command', (req, res) => {
  const { clientId, command } = req.body;
  // In production, this would queue commands for client agents
  res.json({ 
    success: true, 
    commandId: Date.now().toString(),
    message: 'Command queued for client agent' 
  });
});

app.get('/api/agent/status/:clientId', (req, res) => {
  res.json({ 
    clientId: req.params.clientId,
    status: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'This endpoint does not exist',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Export for Vercel
export default app;
