/**
 * Tunnel Proxy - Dynamic proxy for VNC and Terminal based on project
 * 
 * Proxies VNC and terminal connections to Cloudflare tunnels.
 * Fetches tunnel URLs from database based on project ID.
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Dynamic VNC proxy - fetches target URL from database
 * GET /api/proxy/:projectId/vnc/*
 */
router.use('/:projectId/vnc', async (req, res, next) => {
  const { projectId } = req.params;
  
  try {
    // Fetch project's VNC URL from database
    const { data: project, error } = await supabase
      .from('projects')
      .select('vnc_url')
      .eq('id', projectId)
      .single();
    
    if (error || !project || !project.vnc_url) {
      return res.status(404).json({ error: 'Project VNC URL not found' });
    }
    
    // Create dynamic proxy
    const proxy = createProxyMiddleware({
      target: project.vnc_url,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for VNC
      pathRewrite: {
        [`^/api/proxy/${projectId}/vnc`]: '', // Remove prefix
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      },
      onError: (err, req, res) => {
        console.error(`VNC Proxy error for project ${projectId}:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'VNC proxy error', message: err.message });
        }
      }
    });
    
    proxy(req, res, next);
  } catch (error) {
    console.error('Error fetching VNC URL:', error);
    res.status(500).json({ error: 'Failed to fetch VNC URL' });
  }
});

/**
 * Dynamic Terminal proxy - fetches target URL from database
 * GET /api/proxy/:projectId/terminal/*
 */
router.use('/:projectId/terminal', async (req, res, next) => {
  const { projectId } = req.params;
  
  try {
    // Fetch project's terminal URL from database
    const { data: project, error } = await supabase
      .from('projects')
      .select('terminal_url')
      .eq('id', projectId)
      .single();
    
    if (error || !project || !project.terminal_url) {
      return res.status(404).json({ error: 'Project terminal URL not found' });
    }
    
    // Create dynamic proxy
    const proxy = createProxyMiddleware({
      target: project.terminal_url,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying for terminal
      pathRewrite: {
        [`^/api/proxy/${projectId}/terminal`]: '', // Remove prefix
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      },
      onError: (err, req, res) => {
        console.error(`Terminal Proxy error for project ${projectId}:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Terminal proxy error', message: err.message });
        }
      }
    });
    
    proxy(req, res, next);
  } catch (error) {
    console.error('Error fetching terminal URL:', error);
    res.status(500).json({ error: 'Failed to fetch terminal URL' });
  }
});

module.exports = router;
