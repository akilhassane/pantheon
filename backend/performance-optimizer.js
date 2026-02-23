/**
 * Performance Optimization System
 * Implements caching, connection pooling, and request optimization
 */

class PerformanceOptimizer {
  constructor() {
    this.responseCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.requestQueue = [];
    this.isProcessing = false;
    this.debounceTimers = new Map();
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      requestTimes: []
    };
  }

  /**
   * Cache response
   */
  cacheResponse(key, data, ttl = this.cacheTimeout) {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Auto-cleanup
    setTimeout(() => {
      this.responseCache.delete(key);
    }, ttl);
  }

  /**
   * Get cached response
   */
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl) {
      this.responseCache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return cached.data;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(type, params) {
    return `${type}:${JSON.stringify(params)}`;
  }

  /**
   * Debounce request
   */
  debounce(key, fn, delay = 300) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        this.debounceTimers.delete(key);
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);

      this.debounceTimers.set(key, timer);
    });
  }

  /**
   * Add request to queue
   */
  async queueRequest(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  /**
   * Process request queue
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      const startTime = Date.now();

      try {
        const result = await item.request();
        const duration = Date.now() - startTime;
        
        this.recordMetric(duration);
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  /**
   * Record performance metric
   */
  recordMetric(duration) {
    this.metrics.totalRequests++;
    this.metrics.requestTimes.push(duration);

    // Keep only last 100 measurements
    if (this.metrics.requestTimes.length > 100) {
      this.metrics.requestTimes.shift();
    }

    // Calculate average
    this.metrics.averageResponseTime = 
      this.metrics.requestTimes.reduce((a, b) => a + b, 0) / 
      this.metrics.requestTimes.length;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const cacheHitRate = this.metrics.totalRequests > 0
      ? (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.responseCache.size,
      queueLength: this.requestQueue.length,
      averageResponseTime: `${this.metrics.averageResponseTime.toFixed(2)}ms`
    };
  }

  /**
   * Optimize command execution
   */
  async optimizeCommandExecution(command, executor) {
    // Check cache first
    const cacheKey = this.generateCacheKey('command', { command });
    const cached = this.getCachedResponse(cacheKey);
    
    if (cached) {
      return {
        ...cached,
        fromCache: true
      };
    }

    // Execute command
    const startTime = Date.now();
    const result = await executor(command);
    const duration = Date.now() - startTime;

    this.recordMetric(duration);

    // Cache if successful and quick
    if (result.success && duration < 5000) {
      this.cacheResponse(cacheKey, result, 60000); // 1 minute cache
    }

    return {
      ...result,
      fromCache: false,
      duration
    };
  }

  /**
   * Batch similar requests
   */
  async batchRequests(requests, executor) {
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => executor(req))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Lazy load data
   */
  async lazyLoad(dataLoader, chunkSize = 10) {
    const chunks = [];
    let offset = 0;

    while (true) {
      const chunk = await dataLoader(offset, chunkSize);
      
      if (!chunk || chunk.length === 0) {
        break;
      }

      chunks.push(chunk);
      offset += chunkSize;

      if (chunk.length < chunkSize) {
        break;
      }
    }

    return chunks.flat();
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.responseCache.clear();
      return this.responseCache.size;
    }

    let cleared = 0;
    for (const [key, value] of this.responseCache.entries()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      requestTimes: []
    };
  }
}

module.exports = PerformanceOptimizer;
