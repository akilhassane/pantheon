/**
 * Performance Monitor for AI Desktop Agent
 * Tracks latency, API response times, and resource usage
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      screenshotCapture: [],
      geminiApiCalls: [],
      actionExecution: [],
      taskCompletion: [],
    };
    
    this.startTime = Date.now();
    this.enabled = true;
  }

  /**
   * Record screenshot capture latency
   */
  recordScreenshotCapture(duration) {
    if (!this.enabled) return;
    
    this.metrics.screenshotCapture.push({
      duration,
      timestamp: Date.now(),
    });
    
    // Keep last 100 measurements
    if (this.metrics.screenshotCapture.length > 100) {
      this.metrics.screenshotCapture.shift();
    }
  }

  /**
   * Record Gemini API call
   */
  recordGeminiApiCall(type, duration, success = true) {
    if (!this.enabled) return;
    
    this.metrics.geminiApiCalls.push({
      type, // 'analyze', 'plan', 'verify'
      duration,
      success,
      timestamp: Date.now(),
    });
    
    if (this.metrics.geminiApiCalls.length > 100) {
      this.metrics.geminiApiCalls.shift();
    }
  }

  /**
   * Record action execution
   */
  recordActionExecution(actionType, duration, success = true) {
    if (!this.enabled) return;
    
    this.metrics.actionExecution.push({
      actionType,
      duration,
      success,
      timestamp: Date.now(),
    });
    
    if (this.metrics.actionExecution.length > 100) {
      this.metrics.actionExecution.shift();
    }
  }

  /**
   * Record task completion
   */
  recordTaskCompletion(duration, stepsCompleted, success = true) {
    if (!this.enabled) return;
    
    this.metrics.taskCompletion.push({
      duration,
      stepsCompleted,
      success,
      timestamp: Date.now(),
    });
    
    if (this.metrics.taskCompletion.length > 50) {
      this.metrics.taskCompletion.shift();
    }
  }

  /**
   * Get statistics for a metric
   */
  getStats(metricName) {
    const data = this.metrics[metricName];
    if (!data || data.length === 0) {
      return null;
    }

    const durations = data.map(m => m.duration);
    const sorted = durations.sort((a, b) => a - b);
    
    return {
      count: data.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get comprehensive performance report
   */
  getReport() {
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime: {
        ms: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
      },
      screenshotCapture: this.getStats('screenshotCapture'),
      geminiApiCalls: this.getStats('geminiApiCalls'),
      actionExecution: this.getStats('actionExecution'),
      taskCompletion: this.getStats('taskCompletion'),
      successRates: {
        geminiApi: this._calculateSuccessRate('geminiApiCalls'),
        actions: this._calculateSuccessRate('actionExecution'),
        tasks: this._calculateSuccessRate('taskCompletion'),
      },
      resourceUsage: this._getResourceUsage(),
    };
  }

  /**
   * Calculate success rate for a metric
   */
  _calculateSuccessRate(metricName) {
    const data = this.metrics[metricName];
    if (!data || data.length === 0) {
      return null;
    }

    const successful = data.filter(m => m.success).length;
    return {
      successful,
      total: data.length,
      rate: (successful / data.length * 100).toFixed(2) + '%',
    };
  }

  /**
   * Get current resource usage
   */
  _getResourceUsage() {
    const usage = process.memoryUsage();
    
    return {
      memory: {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      },
    };
  }

  /**
   * Print formatted report
   */
  printReport() {
    const report = this.getReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE REPORT');
    console.log('='.repeat(60));
    
    console.log('\n⏱️  Uptime:');
    console.log(`   ${report.uptime.minutes} minutes (${report.uptime.seconds}s)`);
    
    if (report.screenshotCapture) {
      console.log('\n📸 Screenshot Capture:');
      console.log(`   Count: ${report.screenshotCapture.count}`);
      console.log(`   Avg: ${report.screenshotCapture.avg.toFixed(0)}ms`);
      console.log(`   Min: ${report.screenshotCapture.min}ms`);
      console.log(`   Max: ${report.screenshotCapture.max}ms`);
      console.log(`   P95: ${report.screenshotCapture.p95}ms`);
    }
    
    if (report.geminiApiCalls) {
      console.log('\n🤖 Gemini API Calls:');
      console.log(`   Count: ${report.geminiApiCalls.count}`);
      console.log(`   Avg: ${report.geminiApiCalls.avg.toFixed(0)}ms`);
      console.log(`   Min: ${report.geminiApiCalls.min}ms`);
      console.log(`   Max: ${report.geminiApiCalls.max}ms`);
      console.log(`   P95: ${report.geminiApiCalls.p95}ms`);
      if (report.successRates.geminiApi) {
        console.log(`   Success Rate: ${report.successRates.geminiApi.rate}`);
      }
    }
    
    if (report.actionExecution) {
      console.log('\n⚡ Action Execution:');
      console.log(`   Count: ${report.actionExecution.count}`);
      console.log(`   Avg: ${report.actionExecution.avg.toFixed(0)}ms`);
      console.log(`   Min: ${report.actionExecution.min}ms`);
      console.log(`   Max: ${report.actionExecution.max}ms`);
      console.log(`   P95: ${report.actionExecution.p95}ms`);
      if (report.successRates.actions) {
        console.log(`   Success Rate: ${report.successRates.actions.rate}`);
      }
    }
    
    if (report.taskCompletion) {
      console.log('\n✅ Task Completion:');
      console.log(`   Count: ${report.taskCompletion.count}`);
      console.log(`   Avg Duration: ${report.taskCompletion.avg.toFixed(0)}ms`);
      console.log(`   Min: ${report.taskCompletion.min}ms`);
      console.log(`   Max: ${report.taskCompletion.max}ms`);
      if (report.successRates.tasks) {
        console.log(`   Success Rate: ${report.successRates.tasks.rate}`);
      }
    }
    
    console.log('\n💾 Resource Usage:');
    console.log(`   Heap Used: ${report.resourceUsage.memory.heapUsed}`);
    console.log(`   Heap Total: ${report.resourceUsage.memory.heapTotal}`);
    console.log(`   RSS: ${report.resourceUsage.memory.rss}`);
    
    console.log('\n' + '='.repeat(60));
  }

  /**
   * Check if metrics meet performance benchmarks
   */
  checkBenchmarks() {
    const report = this.getReport();
    const results = {
      passed: [],
      failed: [],
    };

    // Screenshot capture should be < 200ms
    if (report.screenshotCapture) {
      if (report.screenshotCapture.avg < 200) {
        results.passed.push('Screenshot capture latency');
      } else {
        results.failed.push(`Screenshot capture: ${report.screenshotCapture.avg.toFixed(0)}ms (target: <200ms)`);
      }
    }

    // Gemini API should be < 5000ms
    if (report.geminiApiCalls) {
      if (report.geminiApiCalls.avg < 5000) {
        results.passed.push('Gemini API response time');
      } else {
        results.failed.push(`Gemini API: ${report.geminiApiCalls.avg.toFixed(0)}ms (target: <5000ms)`);
      }
    }

    // Action execution should be < 500ms
    if (report.actionExecution) {
      if (report.actionExecution.avg < 500) {
        results.passed.push('Action execution time');
      } else {
        results.failed.push(`Action execution: ${report.actionExecution.avg.toFixed(0)}ms (target: <500ms)`);
      }
    }

    return results;
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      screenshotCapture: [],
      geminiApiCalls: [],
      actionExecution: [],
      taskCompletion: [],
    };
    this.startTime = Date.now();
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

module.exports = PerformanceMonitor;
