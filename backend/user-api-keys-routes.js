/**
 * User API Keys Routes
 * Handles user-specific API keys for AI providers
 */

const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Encryption key from environment (should be a strong secret)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt an API key
 */
function encryptApiKey(apiKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex'), iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt an API key
 */
function decryptApiKey(encryptedData) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex'),
    Buffer.from(encryptedData.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = (supabase) => {
  /**
   * Get all API keys for a user (returns masked keys)
   */
  router.get('/api/user/api-keys', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('id, provider, is_active, created_at, updated_at, last_used_at')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (error) {
        console.error('[UserAPIKeys] Error fetching keys:', error);
        return res.status(500).json({ error: 'Failed to fetch API keys' });
      }
      
      res.json({ keys: data || [] });
    } catch (error) {
      console.error('[UserAPIKeys] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Add or update an API key for a provider
   */
  router.post('/api/user/api-keys', async (req, res) => {
    console.log('[UserAPIKeys] POST /api/user/api-keys - Request received');
    console.log('[UserAPIKeys] Headers:', req.headers);
    console.log('[UserAPIKeys] Body:', { provider: req.body.provider, hasApiKey: !!req.body.apiKey });
    
    try {
      const userId = req.headers['x-user-id'];
      const { provider, apiKey } = req.body;
      
      console.log('[UserAPIKeys] User ID:', userId);
      console.log('[UserAPIKeys] Provider:', provider);
      
      if (!userId) {
        console.log('[UserAPIKeys] ERROR: No user ID provided');
        return res.status(401).json({ error: 'User ID required' });
      }
      
      if (!provider || !apiKey) {
        console.log('[UserAPIKeys] ERROR: Missing provider or API key');
        return res.status(400).json({ error: 'Provider and API key required' });
      }
      
      // Normalize provider to lowercase
      const normalizedProvider = provider.toLowerCase();
      
      // Validate provider
      const validProviders = ['openrouter', 'openai', 'anthropic', 'gemini', 'mistral', 'cohere'];
      if (!validProviders.includes(normalizedProvider)) {
        console.log('[UserAPIKeys] ERROR: Invalid provider:', provider);
        return res.status(400).json({ error: 'Invalid provider' });
      }
      
      console.log('[UserAPIKeys] Encrypting API key...');
      // Encrypt the API key
      const encrypted = encryptApiKey(apiKey);
      const encryptedKey = JSON.stringify(encrypted);
      
      // Always insert a new key (allow multiple keys per provider)
      console.log('[UserAPIKeys] Inserting new key...');
      const { error } = await supabase
        .from('user_api_keys')
        .insert({
          user_id: userId,
          provider: normalizedProvider,
          api_key: encryptedKey,
          is_active: true
        });
      
      if (error) {
        console.error('[UserAPIKeys] Error inserting key:', error);
        return res.status(500).json({ error: 'Failed to save API key' });
      }
      
      console.log('[UserAPIKeys] ✅ API key saved successfully');
      
      // Return the inserted key ID
      const { data: insertedKey } = await supabase
        .from('user_api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', normalizedProvider)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      res.json({ 
        success: true, 
        message: 'API key saved', 
        provider: normalizedProvider,
        keyId: insertedKey?.id
      });
    } catch (error) {
      console.error('[UserAPIKeys] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Delete an API key
   */
  router.delete('/api/user/api-keys/:provider', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      const { provider } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { error } = await supabase
        .from('user_api_keys')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('provider', provider);
      
      if (error) {
        console.error('[UserAPIKeys] Error deleting key:', error);
        return res.status(500).json({ error: 'Failed to delete API key' });
      }
      
      res.json({ success: true, message: 'API key deleted' });
    } catch (error) {
      console.error('[UserAPIKeys] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * Get decrypted API key for a user and provider (internal use only)
   * Returns the most recently used key, or the most recent key if none have been used
   */
  router.getUserApiKey = async (userId, provider) => {
    try {
      // Get all active keys for this user/provider, ordered by last_used_at (most recent first)
      // If last_used_at is null, order by created_at (most recent first)
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('api_key, id, last_used_at, created_at')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error || !data || data.length === 0) {
        return null;
      }
      
      const keyData = data[0];
      
      // Update last_used_at
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyData.id);
      
      // Decrypt and return
      const encryptedData = JSON.parse(keyData.api_key);
      return decryptApiKey(encryptedData);
    } catch (error) {
      console.error('[UserAPIKeys] Error getting key:', error);
      return null;
    }
  };
  
  /**
   * Get decrypted API key by ID (internal use only)
   */
  router.getUserApiKeyById = async (userId, keyId) => {
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('api_key, id, provider')
        .eq('user_id', userId)
        .eq('id', keyId)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // Update last_used_at
      await supabase
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);
      
      // Decrypt and return
      const encryptedData = JSON.parse(data.api_key);
      return decryptApiKey(encryptedData);
    } catch (error) {
      console.error('[UserAPIKeys] Error getting key by ID:', error);
      return null;
    }
  };
  
  return router;
};
