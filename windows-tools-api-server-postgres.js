#!/usr/bin/env node

/**
 * Windows Tools API Server - Encrypted Code-as-a-Service
 * Secure API service that encrypts and sends Python scripts to Windows VMs
 * Scripts are encrypted before transmission and decrypted in Windows VM
 * 
 * AUTHENTICATION: Each project has a unique API service key stored in the database
 * ENCRYPTION: Scripts encrypted with AES-256-GCM using project-specific keys
 * DATABASE: Uses PostgreSQL directly via pg library
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8090;

// Initialize PostgreSQL connection pool
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_URL;

if (!databaseUrl) {
  console.error('[Windows Tools API] ERROR: DATABASE_URL must be set');
  process.exit(1);
}

// Extract connection details from URL
let pgConfig;
if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
  pgConfig = { connectionString: databaseUrl };
} else {
  // Handle http://host:port format (convert to postgresql://)
  const url = databaseUrl.replace('http://', '').replace('https://', '');
  const [host, port] = url.split(':');
  pgConfig = {
    host: host,
    port: parseInt(port) || 5432,
    database: 'ai_backend',
    user: 'postgres',
    password: 'postgres'
  };
}

const pool = new Pool({
  ...pgConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client', err);
});

console.log('[Windows Tools API] PostgreSQL connection pool initialized');

// Cache for API keys to reduce database queries
const apiKeyCache = new Map(); // key -> { projectId, containerName, encryptionKey, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Encryption settings
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { success: false, error: 'Too many requests' }
});
app.use('/api/', limiter);

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Authentication middleware - validates per-project API service keys
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const providedKey = authHeader?.replace('Bearer ', '');
  
  if (!providedKey) {
    log(`Auth failed from ${req.ip}: No API key provided`);
    return res.status(401).json({ success: false, error: 'Unauthorized: API key required' });
  }
  
  // Check cache first
  const cached = apiKeyCache.get(providedKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    req.projectId = cached.projectId;
    req.containerName = cached.containerName;
    req.encryptionKey = cached.encryptionKey;
    return next();
  }
  
  // Validate against database
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, name, container_id, encryption_key FROM projects WHERE api_service_key = $1 LIMIT 1',
      [providedKey]
    );
    
    if (result.rows.length === 0) {
      log(`Auth failed from ${req.ip}: Invalid API service key`);
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API key' });
    }
    
    const data = result.rows[0];
    
    // Generate encryption key if not exists
    let encryptionKey = data.encryption_key;
    if (!encryptionKey) {
      encryptionKey = crypto.randomBytes(32).toString('hex');
      await client.query(
        'UPDATE projects SET encryption_key = $1 WHERE id = $2',
        [encryptionKey, data.id]
      );
      log(`Generated encryption key for project: ${data.id}`);
    }
    
    // Cache the valid key
    apiKeyCache.set(providedKey, {
      projectId: data.id,
      containerName: data.container_id,
      encryptionKey: encryptionKey,
      timestamp: Date.now()
    });
    
    req.projectId = data.id;
    req.containerName = data.container_id;
    req.encryptionKey = encryptionKey;
    log(`Auth successful for project: ${data.name} (${data.id})`);
    next();
    
  } catch (dbError) {
    log(`Auth error: ${dbError.message}`);
    return res.status(500).json({ success: false, error: 'Authentication error' });
  } finally {
    client.release();
  }
}


// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} keyHex - Encryption key (hex string)
 * @returns {Object} Encrypted data with IV and auth tag
 */
function encrypt(text, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Get decryption instructions for client
 * @param {string} keyHex - Encryption key
 * @returns {Object} Decryption instructions
 */
function getDecryptionInstructions(keyHex) {
  return {
    algorithm: ENCRYPTION_ALGORITHM,
    key: keyHex,
    instructions: 'Decrypt using AES-256-GCM with provided key, IV, and auth tag'
  };
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Get Python script content
 * @param {string} scriptName - Name of the Python script
 * @returns {Promise<string>} Script content
 */
async function getScriptContent(scriptName) {
  try {
    // Use tools-standalone/ folder with self-contained scripts
    const scriptPath = path.join(__dirname, 'tools-standalone', scriptName);
    const content = await fs.readFile(scriptPath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read script ${scriptName}: ${error.message}`);
  }
}

/**
 * Prepare encrypted tool execution
 * @param {string} scriptName - Name of the Python script
 * @param {Array} args - Arguments for the script
 * @param {string} encryptionKey - Project-specific encryption key
 * @returns {Object} Encrypted execution instructions
 */
async function prepareEncryptedToolExecution(scriptName, args, encryptionKey) {
  try {
    const scriptContent = await getScriptContent(scriptName);
    
    // Encrypt the script
    const encrypted = encrypt(scriptContent, encryptionKey);
    
    return {
      success: true,
      encrypted: true,
      encryptedScript: encrypted.encrypted,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      scriptName: scriptName,
      arguments: args,
      decryption: getDecryptionInstructions(encryptionKey)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve documentation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// List available tools
app.get('/api/tools', authenticate, (req, res) => {
  res.json({
    success: true,
    tools: [
      { name: 'take_screenshot', description: 'Capture screen with OCR and UI elements' },
      { name: 'execute_powershell', description: 'Execute PowerShell commands' },
      { name: 'move_mouse', description: 'Move mouse to coordinates' },
      { name: 'click_mouse', description: 'Click mouse at coordinates' },
      { name: 'get_mouse_position', description: 'Get current mouse position' },
      { name: 'type_text', description: 'Type text using keyboard' },
      { name: 'press_key', description: 'Press keyboard key' },
      { name: 'scroll_mouse', description: 'Scroll mouse wheel' },
      { name: 'find_text_on_screen', description: 'Search for text on screen' },
      { name: 'send_to_terminal', description: 'Send command to terminal' }
    ]
  });
});

// Execute tool
app.post('/api/execute', authenticate, async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    
    if (!tool) {
      return res.status(400).json({ success: false, error: 'Tool name required' });
    }
    
    log(`Executing tool: ${tool} for project ${req.projectId}`);
    
    // Map tool names to script files (must match actual filenames in tools-standalone/)
    const toolScriptMap = {
      'take_screenshot': 'screenshot.py',
      'execute_powershell': 'execute_powershell.py',
      'move_mouse': 'mouse-move.py',
      'click_mouse': 'mouse-click.py',
      'get_mouse_position': 'mouse-position.py',
      'type_text': 'keyboard-type.py',
      'press_key': 'keyboard-press.py',
      'scroll_mouse': 'mouse-scroll.py',
      'find_text_on_screen': 'find_text_on_screen.py',
      'send_to_terminal': 'send-to-terminal.py'
    };
    
    const scriptName = toolScriptMap[tool];
    if (!scriptName) {
      return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
    }
    
    // Prepare script arguments
    const scriptArgs = [];
    if (args) {
      // Convert arguments object to command line args
      for (const [key, value] of Object.entries(args)) {
        scriptArgs.push(`--${key}`);
        if (value !== true && value !== '') {
          scriptArgs.push(String(value));
        }
      }
    }
    
    // Always add --json flag for structured output
    if (!scriptArgs.includes('--json')) {
      scriptArgs.push('--json');
    }
    
    // Prepare encrypted execution
    const result = await prepareEncryptedToolExecution(scriptName, scriptArgs, req.encryptionKey);
    
    res.json(result);
    
  } catch (error) {
    log(`Tool execution error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log(`Windows Tools API listening on port ${PORT}`);
  log(`Architecture: Encrypted Code-as-a-Service (AES-256-GCM)`);
  log(`Per-project encryption keys enabled`);
  log(`Database: PostgreSQL`);
  log(`Ready to accept requests`);
});
