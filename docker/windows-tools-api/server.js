/**
 * Windows Tools API Server - Encrypted Code-as-a-Service
 * Secure API service that encrypts and sends Python scripts to Windows VMs
 * Scripts are encrypted before transmission and decrypted in Windows VM
 * 
 * AUTHENTICATION: Each project has a unique API service key stored in the database
 * ENCRYPTION: Scripts encrypted with AES-256-GCM using project-specific keys
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 8090;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
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

// Custom JSON parser with better error handling
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for debugging
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}));

// Error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    log(`JSON Parse Error from ${req.ip} on ${req.method} ${req.path}`);
    log(`Content-Type: ${req.headers['content-type']}`);
    log(`Raw body (first 200 chars): ${req.rawBody?.substring(0, 200)}`);
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON in request body',
      details: err.message 
    });
  }
  next(err);
});

// Rate limiting (optional - commented out for now)
// const rateLimit = require('express-rate-limit');
// const limiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 100, // 100 requests per minute
//   message: { success: false, error: 'Too many requests' }
// });
// app.use('/api/', limiter);

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
  
  // Validate against PostgreSQL database
  try {
    const result = await pool.query(
      'SELECT id, name, container_name, encryption_key FROM projects WHERE api_service_key = $1',
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
      await pool.query(
        'UPDATE projects SET encryption_key = $1 WHERE id = $2',
        [encryptionKey, data.id]
      );
      log(`Generated encryption key for project: ${data.id}`);
    }
    
    // Cache the valid key
    apiKeyCache.set(providedKey, {
      projectId: data.id,
      containerName: data.container_name,
      encryptionKey: encryptionKey,
      timestamp: Date.now()
    });
    
    req.projectId = data.id;
    req.containerName = data.container_name;
    req.encryptionKey = encryptionKey;
    
    log(`Auth successful for project: ${data.name} (${data.id})`);
    return next();
    
  } catch (error) {
    log(`Auth error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
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
    // Use tools/ folder with full-featured scripts
    const scriptPath = path.join(__dirname, 'tools', scriptName);
    const content = await fs.readFile(scriptPath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read script ${scriptName}: ${error.message}`);
  }
}

/**
 * Prepare encrypted tool execution with helper scripts
 * @param {string} scriptName - Name of the Python script
 * @param {Array} args - Arguments for the script
 * @param {string} encryptionKey - Project-specific encryption key
 * @param {Array} helperScripts - Optional array of helper script names to bundle
 * @returns {Object} Encrypted execution instructions
 */
async function prepareEncryptedToolExecution(scriptName, args, encryptionKey, helperScripts = []) {
  try {
    const scriptContent = await getScriptContent(scriptName);
    
    // Encrypt the main script
    const encrypted = encrypt(scriptContent, encryptionKey);
    
    const result = {
      success: true,
      encrypted: true,
      encryptedScript: encrypted.encrypted,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      scriptName: scriptName,
      arguments: args,
      decryption: getDecryptionInstructions(encryptionKey),
      instruction: 'Decrypt and execute this Python script with the provided arguments'
    };
    
    // Bundle helper scripts if provided
    if (helperScripts && helperScripts.length > 0) {
      result.helperScripts = [];
      
      for (const helperName of helperScripts) {
        try {
          const helperContent = await getScriptContent(helperName);
          const helperEncrypted = encrypt(helperContent, encryptionKey);
          
          result.helperScripts.push({
            name: helperName,
            encryptedContent: helperEncrypted.encrypted,
            iv: helperEncrypted.iv,
            authTag: helperEncrypted.authTag
          });
        } catch (error) {
          log(`Warning: Failed to bundle helper script ${helperName}: ${error.message}`);
        }
      }
      
      log(`Bundled ${result.helperScripts.length} helper scripts with ${scriptName}`);
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute PowerShell command
 */
async function executePowerShell(command, encryptionKey) {
  try {
    log(`Preparing PowerShell execution`);
    
    // Encrypt the command
    const encrypted = encrypt(command, encryptionKey);
    
    return {
      success: true,
      encrypted: true,
      type: 'powershell',
      encryptedCommand: encrypted.encrypted,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      decryption: getDecryptionInstructions(encryptionKey),
      instruction: 'Decrypt and execute this PowerShell command'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Take screenshot - consolidated version with all functionality embedded
 */
async function takeScreenshot(encryptionKey) {
  try {
    log(`Preparing screenshot tool (consolidated version - no helper scripts needed)`);
    
    // No helper scripts needed - all functionality is now embedded in screenshot.py
    return await prepareEncryptedToolExecution('screenshot.py', ['--json'], encryptionKey);
  } catch (error) {
    log(`Screenshot error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Move mouse
 */
async function moveMouse(x, y, encryptionKey) {
  return await prepareEncryptedToolExecution('mouse-move.py', ['--x', x, '--y', y, '--json'], encryptionKey);
}

/**
 * Click mouse
 */
async function clickMouse(x, y, button = 'left', doubleClick = false, encryptionKey) {
  const args = ['--x', x, '--y', y, '--button', button, '--json'];
  if (doubleClick) args.push('--double');
  return await prepareEncryptedToolExecution('mouse-click.py', args, encryptionKey);
}

/**
 * Get mouse position
 */
async function getMousePosition(encryptionKey) {
  return await prepareEncryptedToolExecution('mouse-position.py', ['--json'], encryptionKey);
}

/**
 * Type text
 */
async function typeText(text, interval = 0.05, encryptionKey) {
  return await prepareEncryptedToolExecution('keyboard-type.py', [text, '--interval', interval, '--json'], encryptionKey);
}

/**
 * Press key
 */
async function pressKey(key, encryptionKey) {
  return await prepareEncryptedToolExecution('keyboard-press.py', [key, '--json'], encryptionKey);
}

/**
 * Scroll mouse
 */
async function scrollMouse(direction, clicks = 3, x = null, y = null, encryptionKey) {
  const args = [direction, '--clicks', clicks, '--json'];
  if (x !== null && y !== null) {
    args.push('--x', x, '--y', y);
  }
  return await prepareEncryptedToolExecution('mouse-scroll.py', args, encryptionKey);
}

/**
 * Find text on screen (OCR)
 */
async function findTextOnScreen(text, partialMatch = true, encryptionKey) {
  const args = [text, '--json'];
  if (partialMatch) args.push('--partial');
  return await prepareEncryptedToolExecution('ocr_detector.py', args, encryptionKey);
}

/**
 * Send command to terminal
 */
async function sendToTerminal(command, terminalPort, encryptionKey) {
  const args = ['--command', command, '--json'];
  // Note: terminal_port will be passed as environment variable TERMINAL_PORT
  return await prepareEncryptedToolExecution('send-to-terminal.py', args, encryptionKey);
}

/**
 * Get all UI elements (taskbar icons, buttons, etc.) using UI Automation
 */
async function getUIElements(encryptionKey) {
  try {
    log(`Preparing UI elements detection tool`);
    return await prepareEncryptedToolExecution('get_ui_elements.py', [], encryptionKey);
  } catch (error) {
    log(`UI elements error: ${error.message}`);
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

// Serve static files from public directory
app.use(express.static('public'));

// Server info - HTML interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// List available tools
app.get('/api/tools', authenticate, (req, res) => {
  res.json({
    success: true,
    architecture: 'Encrypted Code-as-a-Service',
    encryption: 'AES-256-GCM per-project keys',
    tools: [
      { name: 'execute_powershell', description: 'Execute PowerShell command (encrypted)' },
      { name: 'take_screenshot', description: 'Capture screen with OCR analysis (encrypted)' },
      { name: 'get_ui_elements', description: 'Get all UI elements including taskbar icons using UI Automation (encrypted)' },
      { name: 'move_mouse', description: 'Move mouse cursor (encrypted)' },
      { name: 'click_mouse', description: 'Click mouse button (encrypted)' },
      { name: 'get_mouse_position', description: 'Get current mouse position (encrypted)' },
      { name: 'type_text', description: 'Type text via keyboard (encrypted)' },
      { name: 'press_key', description: 'Press keyboard key (encrypted)' },
      { name: 'scroll_mouse', description: 'Scroll mouse wheel (encrypted)' },
      { name: 'find_text_on_screen', description: 'Find text using OCR (encrypted)' },
      { name: 'send_to_terminal', description: 'Send command to PowerShell terminal via WebSocket (encrypted)' }
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
    
    // Get encryption key from authenticate middleware
    const encryptionKey = req.encryptionKey;
    const projectId = req.projectId;
    log(`Executing tool: ${tool} for project: ${projectId} (encrypted)`);
    
    let result;
    
    switch (tool) {
      case 'execute_powershell':
        result = await executePowerShell(args.command, encryptionKey);
        break;
      
      case 'take_screenshot':
        result = await takeScreenshot(encryptionKey);
        break;
      
      case 'get_ui_elements':
        result = await getUIElements(encryptionKey);
        break;
      
      case 'move_mouse':
        result = await moveMouse(args.x, args.y, encryptionKey);
        break;
      
      case 'click_mouse':
        result = await clickMouse(args.x, args.y, args.button || 'left', args.double || false, encryptionKey);
        break;
      
      case 'get_mouse_position':
        result = await getMousePosition(encryptionKey);
        break;
      
      case 'type_text':
        result = await typeText(args.text, args.interval || 0.05, encryptionKey);
        break;
      
      case 'press_key':
        result = await pressKey(args.key, encryptionKey);
        break;
      
      case 'scroll_mouse':
        result = await scrollMouse(args.direction, args.clicks || 3, args.x || null, args.y || null, encryptionKey);
        break;
      
      case 'find_text_on_screen':
        result = await findTextOnScreen(args.text, args.partial_match !== false, encryptionKey);
        break;
      
      case 'send_to_terminal':
        result = await sendToTerminal(args.command, args.terminal_port, encryptionKey);
        // Add terminal port to result so it can be passed as environment variable
        if (result.success && args.terminal_port) {
          result.environment = { TERMINAL_PORT: args.terminal_port };
        }
        break;
      
      default:
        return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
    }
    
    res.json(result);
    
  } catch (error) {
    log(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log(`Windows Tools API listening on port ${PORT}`);
  log(`Architecture: Encrypted Code-as-a-Service (AES-256-GCM)`);
  log(`Per-project encryption keys enabled`);
  log('Ready to accept requests');
});
