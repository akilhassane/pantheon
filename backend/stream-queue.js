/**
 * Stream Queue System
 * Manages concurrent streaming requests with priority queuing
 */

class StreamQueue {
  constructor(maxConcurrent = 10) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.stats = {
      totalProcessed: 0,
      totalQueued: 0,
      totalRejected: 0,
      averageWaitTime: 0
    };
  }

  /**
   * Enqueue a streaming request
   * @param {Function} fn - Async function to execute
   * @param {number} priority - Higher priority executes first (default: 0)
   * @param {number} timeout - Max wait time in queue (ms, default: 60000)
   * @returns {Promise} Resolves when function completes
   */
  async enqueue(fn, priority = 0, timeout = 60000) {
    const startTime = Date.now();

    // If under limit, execute immediately
    if (this.active < this.maxConcurrent) {
      console.log(`🚀 [Queue] Executing immediately (${this.active + 1}/${this.maxConcurrent} active)`);
      return this.execute(fn, startTime);
    }

    // Otherwise, queue it
    console.log(`⏳ [Queue] Queuing request (${this.queue.length} in queue, ${this.active}/${this.maxConcurrent} active)`);
    this.stats.totalQueued++;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue if timeout
        const index = this.queue.findIndex(item => item.timeoutId === timeoutId);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.stats.totalRejected++;
          reject(new Error(`Queue timeout after ${timeout}ms`));
        }
      }, timeout);

      this.queue.push({
        fn,
        priority,
        resolve,
        reject,
        timeoutId,
        startTime
      });

      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);
    });
  }

  /**
   * Execute a function and track it
   * @private
   */
  async execute(fn, startTime) {
    this.active++;
    this.stats.totalProcessed++;

    const waitTime = Date.now() - startTime;
    this.stats.averageWaitTime = 
      (this.stats.averageWaitTime * (this.stats.totalProcessed - 1) + waitTime) / 
      this.stats.totalProcessed;

    if (waitTime > 0) {
      console.log(`⏱️  [Queue] Waited ${waitTime}ms in queue`);
    }

    try {
      const result = await fn();
      return result;
    } finally {
      this.active--;
      console.log(`✅ [Queue] Request completed (${this.active}/${this.maxConcurrent} active, ${this.queue.length} queued)`);
      this.processQueue();
    }
  }

  /**
   * Process next item in queue
   * @private
   */
  processQueue() {
    if (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const item = this.queue.shift();
      clearTimeout(item.timeoutId);

      console.log(`▶️  [Queue] Processing queued request (priority: ${item.priority})`);

      this.execute(item.fn, item.startTime)
        .then(item.resolve)
        .catch(item.reject);
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      ...this.stats,
      active: this.active,
      queued: this.queue.length,
      capacity: this.maxConcurrent,
      utilizationPercent: Math.round((this.active / this.maxConcurrent) * 100)
    };
  }

  /**
   * Clear all queued requests
   */
  clear() {
    for (const item of this.queue) {
      clearTimeout(item.timeoutId);
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    console.log(`🗑️  [Queue] Cleared all queued requests`);
  }

  /**
   * Update max concurrent limit
   */
  setMaxConcurrent(max) {
    console.log(`⚙️  [Queue] Updating max concurrent: ${this.maxConcurrent} → ${max}`);
    this.maxConcurrent = max;
    
    // Process queue if we increased capacity
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      this.processQueue();
    }
  }
}

module.exports = StreamQueue;
