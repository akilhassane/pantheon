/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are set before
 * the application starts. Provides clear error messages for missing variables.
 */

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = {
  // Supabase Configuration
  SUPABASE_URL: 'Supabase project URL (e.g., https://xxx.supabase.co)',
  SUPABASE_SERVICE_KEY: 'Supabase service role key (server-side only)',
  
  // API Keys
  GEMINI_API_KEY: 'Google Gemini API key for AI functionality',
  
  // Optional but recommended
  OPENROUTER_API_KEY: 'OpenRouter API key (optional, for alternative models)'
};

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  PORT: '3001',
  NODE_ENV: 'development',
  MCP_CONTAINER_NAME: 'kali-pentest',
  GOTTY_HOST: 'kali-pentest',
  ENABLE_FALLBACK_MODE: 'true'
};

/**
 * Validate environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnvironment() {
  console.log('[Environment] Validating environment variables...');
  
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!process.env[key]) {
      // Skip OPENROUTER_API_KEY as it's optional
      if (key === 'OPENROUTER_API_KEY') {
        warnings.push(`⚠️  ${key}: ${description} (optional)`);
        continue;
      }
      missing.push(`❌ ${key}: ${description}`);
    } else {
      console.log(`✅ ${key}: Set`);
    }
  }

  // Set defaults for optional variables
  for (const [key, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      console.log(`ℹ️  ${key}: Using default value "${defaultValue}"`);
    } else {
      console.log(`✅ ${key}: ${process.env[key]}`);
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('\n[Environment] Warnings:');
    warnings.forEach(warning => console.log(warning));
  }

  // Throw error if required variables are missing
  if (missing.length > 0) {
    console.error('\n[Environment] ❌ Missing required environment variables:\n');
    missing.forEach(msg => console.error(msg));
    console.error('\nPlease set these variables in your .env file or environment.\n');
    throw new Error('Missing required environment variables');
  }

  console.log('[Environment] ✅ All required environment variables are set\n');
}

/**
 * Validate Supabase-specific configuration
 */
function validateSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return; // Already caught by validateEnvironment
  }

  // Validate URL format
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.warn('[Environment] ⚠️  SUPABASE_URL format may be incorrect. Expected format: https://xxx.supabase.co');
  }

  // Validate service key format (should be a JWT)
  if (!serviceKey.startsWith('eyJ')) {
    console.warn('[Environment] ⚠️  SUPABASE_SERVICE_KEY format may be incorrect. Should be a JWT token starting with "eyJ"');
  }

  console.log('[Environment] ✅ Supabase configuration validated');
}

/**
 * Print environment summary
 */
function printEnvironmentSummary() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                 ENVIRONMENT CONFIGURATION                 ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Port: ${process.env.PORT}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`MCP Container: ${process.env.MCP_CONTAINER_NAME}`);
  console.log(`GoTTY Host: ${process.env.GOTTY_HOST}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

module.exports = {
  validateEnvironment,
  validateSupabaseConfig,
  printEnvironmentSummary
};
