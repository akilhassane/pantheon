// Railway Server - Simplified backend for client-agent coordination
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);

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
    mode: 'serverful',
    message: 'Backend server is running. Containers are managed by client agents.'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mode: 'serverful'
  });
});

// Client agent registration
app.post('/api/agent/register', (req, res) => {
  const { clientId, capabilities } = req.body;
  console.log(`[Agent] Registered: ${clientId}`, capabilities);
  res.json({ 
    success: true, 
    clientId,
    message: 'Client agent registered successfully' 
  });
});

// Command queue for client agents
app.post('/api/agent/command', (req, res) => {
  const { clientId, command } = req.body;
  console.log(`[Agent] Command for ${clientId}:`, command);
  res.json({ 
    success: true, 
    commandId: Date.now().toString(),
    message: 'Command queued for client agent' 
  });
});

// Agent status
app.get('/api/agent/status/:clientId', (req, res) => {
  res.json({ 
    clientId: req.params.clientId,
    status: 'connected',
    timestamp: new Date().toISOString()
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

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Mode: Serverful (Railway)`);
  console.log(`🐳 Containers: Managed by client agents`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
