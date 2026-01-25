// Server-Sent Events endpoint for client agents (Vercel-compatible)
// Alternative to WebSockets for serverless environments

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API key
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (!apiKey || !verifyAgentApiKey(apiKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const clientId = req.headers['x-client-id'] || req.query.clientId;
  if (!clientId) {
    return res.status(400).json({ error: 'Client ID required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log(`Client ${clientId} disconnected`);
  });

  // In a real implementation, you would:
  // 1. Register this client in a database/cache
  // 2. Poll for commands from a queue
  // 3. Send commands to client via SSE
  // 4. Client sends results back via POST endpoint
}

function verifyAgentApiKey(apiKey) {
  const validKey = process.env.AGENT_API_SECRET;
  return apiKey === validKey;
}
