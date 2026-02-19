#!/usr/bin/env node

/**
 * Install Keycloak JWT validation dependencies
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('📦 Installing Keycloak JWT validation dependencies...\n');

try {
  // Install dependencies in backend directory
  const backendDir = path.join(__dirname, 'backend');
  
  console.log('Installing jsonwebtoken and jwks-rsa...');
  execSync('npm install jsonwebtoken@^9.0.2 jwks-rsa@^3.1.0', {
    cwd: backendDir,
    stdio: 'inherit'
  });
  
  console.log('\n✅ Dependencies installed successfully!');
  console.log('\nNext steps:');
  console.log('1. Configure Keycloak realm and clients (see KEYCLOAK_NEXT_STEPS.md)');
  console.log('2. Add Keycloak environment variables to .env');
  console.log('3. Rebuild backend: docker-compose build ai-backend');
  console.log('4. Restart backend: docker-compose restart ai-backend');
  
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}
