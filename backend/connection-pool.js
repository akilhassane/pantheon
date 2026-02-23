/**
 * HTTP/HTTPS Connection Pool
 * Reuses connections for AI API calls to improve performance
 */

const http = require('http');
const https = require('https');

// Create persistent agents with connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,        // Max concurrent connections
  maxFreeSockets: 10,    // Keep 10 idle connections ready
  timeout: 60000,        // 60s timeout
  scheduling: 'lifo'     // Last-in-first-out (reuse recent connections)
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'lifo'
});

/**
 * Get appropriate agent for URL
 * @param {string} url - The URL to fetch
 * @returns {http.Agent|https.Agent} The appropriate agent
 */
function getAgent(url) {
  return url.startsWith('https') ? httpsAgent : httpAgent;
}

/**
 * Enhanced fetch with connection pooling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function pooledFetch(url, options = {}) {
  // Add agent to options
  const agent = getAgent(url);
  
  return fetch(url, {
    ...options,
    agent
  });
}

/**
 * Get connection pool statistics
 */
function getPoolStats() {
  return {
    http: {
      sockets: Object.keys(httpAgent.sockets).length,
      freeSockets: Object.keys(httpAgent.freeSockets).length,
      requests: Object.keys(httpAgent.requests).length
    },
    https: {
      sockets: Object.keys(httpsAgent.sockets).length,
      freeSockets: Object.keys(httpsAgent.freeSockets).length,
      requests: Object.keys(httpsAgent.requests).length
    }
  };
}

/**
 * Destroy all connections (for cleanup)
 */
function destroyPool() {
  httpAgent.destroy();
  httpsAgent.destroy();
  console.log('🔌 [ConnectionPool] All connections destroyed');
}

module.exports = {
  httpAgent,
  httpsAgent,
  getAgent,
  pooledFetch,
  getPoolStats,
  destroyPool
};
