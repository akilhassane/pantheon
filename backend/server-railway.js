// Railway Server - Cloud backend with Supabase integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://pantheon-akil-hassanes-projects.vercel.app',
    'https://pantheon-pi.vercel.app',
    'https://pantheon-kappa.vercel.app',
    'https://frontend-beryl-beta-62.vercel.app',
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

// ==================== SESSION ROUTES ====================

// Get sessions by project
app.get('/api/sessions/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, sessions: data || [], count: data?.length || 0 });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'SESSIONS_GET_FAILED', message: error.message });
  }
});

// Get deleted sessions
app.get('/api/sessions/projects/:projectId/deleted', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('project_id', projectId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, sessions: data || [], count: data?.length || 0 });
  } catch (error) {
    console.error('Error fetching deleted sessions:', error);
    res.status(500).json({ error: 'SESSIONS_GET_FAILED', message: error.message });
  }
});

// Create session
app.post('/api/sessions', async (req, res) => {
  try {
    const { projectId, userId, name, model } = req.body;
    
    if (!projectId || !userId || !name) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Project ID, User ID, and name are required'
      });
    }
    
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        project_id: projectId,
        user_id: userId,
        name,
        model: model || 'gemini-2.5-flash',
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, session: data });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'SESSION_CREATE_FAILED', message: error.message });
  }
});

// Update session
app.patch('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, session: data });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'SESSION_UPDATE_FAILED', message: error.message });
  }
});

// Delete session (soft delete)
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { error } = await supabase
      .from('sessions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'SESSION_DELETE_FAILED', message: error.message });
  }
});

// Restore session
app.post('/api/sessions/:sessionId/restore', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
      .from('sessions')
      .update({ deleted_at: null })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, session: data });
  } catch (error) {
    console.error('Error restoring session:', error);
    res.status(500).json({ error: 'SESSION_RESTORE_FAILED', message: error.message });
  }
});

// Get session history
app.get('/api/sessions/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    res.json({ success: true, messages: data || [] });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'HISTORY_GET_FAILED', message: error.message });
  }
});

// ==================== PROJECT ROUTES ====================

// Helper function to convert snake_case to camelCase for frontend
function convertProjectData(data) {
  if (!data) return null;
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    ownerId: data.owner_id,
    containerId: data.container_id,
    containerName: data.container_name,
    terminalPort: data.terminal_port,
    terminalUrl: data.terminal_url,  // Include terminal tunnel URL
    vncPort: data.vnc_port,
    novncPort: data.novnc_port,
    vncUrl: data.vnc_url,  // Include VNC tunnel URL
    customPort1: data.custom_port_1,
    customPort2: data.custom_port_2,
    operatingSystem: data.operating_system,
    mcpApiKey: data.mcp_api_key,
    status: data.status,
    createdAt: data.created_at,
    lastActive: data.last_active,
    isMock: data.container_id?.startsWith('mock-') || false
  };
}

// Get projects
app.get('/api/projects', async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('owner_id', userId);  // Fixed: use owner_id instead of user_id
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Convert snake_case to camelCase for frontend
    const projects = (data || []).map(convertProjectData);
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'PROJECTS_GET_FAILED', message: error.message });
  }
});

// Create project placeholder
app.post('/api/projects/create-placeholder', async (req, res) => {
  try {
    const { name, userId, osType } = req.body;
    
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        user_id: userId,
        os_type: osType || 'kali',
        status: 'creating'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'PROJECT_CREATE_FAILED', message: error.message });
  }
});

// Initialize project (handled by client agent)
app.post('/api/projects/:projectId/initialize', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Mark as ready (actual initialization done by client agent)
    const { data, error } = await supabase
      .from('projects')
      .update({ status: 'ready' })
      .eq('id', projectId)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error) {
    console.error('Error initializing project:', error);
    res.status(500).json({ error: 'PROJECT_INIT_FAILED', message: error.message });
  }
});

// Get project status
app.get('/api/projects/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const { data, error } = await supabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single();
    
    if (error) throw error;
    res.json({ success: true, status: data.status });
  } catch (error) {
    console.error('Error fetching project status:', error);
    res.status(500).json({ error: 'PROJECT_STATUS_FAILED', message: error.message });
  }
});

// Update project
app.patch('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'PROJECT_UPDATE_FAILED', message: error.message });
  }
});

// ==================== COLLABORATION ROUTES ====================

// Get collaborators
app.get('/api/collaborations/projects/:projectId/collaborators', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const { data, error } = await supabase
      .from('project_collaborators')
      .select('*, users(*)')
      .eq('project_id', projectId);
    
    if (error) throw error;
    res.json({ success: true, collaborators: data || [] });
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: 'COLLABORATORS_GET_FAILED', message: error.message });
  }
});

// Share project
app.post('/api/collaborations/projects/:projectId/share', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { permissions } = req.body;
    
    // Generate share token
    const shareToken = Math.random().toString(36).substring(2, 15);
    
    const { data, error } = await supabase
      .from('project_shares')
      .insert({
        project_id: projectId,
        share_token: shareToken,
        permissions: permissions || 'view'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, shareToken, share: data });
  } catch (error) {
    console.error('Error sharing project:', error);
    res.status(500).json({ error: 'PROJECT_SHARE_FAILED', message: error.message });
  }
});

// Join collaboration
app.post('/api/collaborations/join', async (req, res) => {
  try {
    const { shareToken, userId } = req.body;
    
    // Get share info
    const { data: share, error: shareError } = await supabase
      .from('project_shares')
      .select('*')
      .eq('share_token', shareToken)
      .single();
    
    if (shareError) throw shareError;
    
    // Add collaborator
    const { data, error } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: share.project_id,
        user_id: userId,
        role: share.permissions
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, collaboration: data });
  } catch (error) {
    console.error('Error joining collaboration:', error);
    res.status(500).json({ error: 'COLLABORATION_JOIN_FAILED', message: error.message });
  }
});

// Create session in collaboration
app.post('/api/collaborations/:shareToken/sessions', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { userId, name, model } = req.body;
    
    // Get project from share token
    const { data: share, error: shareError } = await supabase
      .from('project_shares')
      .select('project_id')
      .eq('share_token', shareToken)
      .single();
    
    if (shareError) throw shareError;
    
    // Create session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        project_id: share.project_id,
        user_id: userId,
        name,
        model: model || 'gemini-2.5-flash',
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json({ success: true, session: data });
  } catch (error) {
    console.error('Error creating collaboration session:', error);
    res.status(500).json({ error: 'COLLABORATION_SESSION_FAILED', message: error.message });
  }
});

// ==================== AGENT ROUTES ====================

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
  console.log(`💾 Database: Supabase`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
