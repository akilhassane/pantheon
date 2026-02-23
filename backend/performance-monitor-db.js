/**
 * Performance Monitor (Database)
 * 
 * Tracks and queries performance metrics in partitioned table
 */

class PerformanceMonitor {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
    this.retentionDays = 90; // Default retention period
  }

  /**
   * Track a performance metric
   */
  async trackMetric(metric) {
    try {
      const { data, error } = await this.supabase
        .from('performance_metrics')
        .insert({
          project_id: metric.project_id || null,
          session_id: metric.session_id || null,
          user_id: metric.user_id || null,
          operation_type: metric.operation_type,
          duration_ms: metric.duration_ms,
          memory_mb: metric.memory_mb || null,
          cpu_percent: metric.cpu_percent || null,
          metadata: metric.metadata || null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[PerformanceMonitor] ❌ Failed to track metric:', error.message);
      // Don't throw - metrics shouldn't break the app
      return null;
    }
  }

  /**
   * Get metrics with filtering
   */
  async getMetrics(filters = {}, limit = 100) {
    try {
      let query = this.supabase
        .from('performance_metrics')
        .select('*');
      
      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters.session_id) {
        query = query.eq('session_id', filters.session_id);
      }
      
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      
      if (filters.operation_type) {
        query = query.eq('operation_type', filters.operation_type);
      }
      
      if (filters.start_date) {
        query = query.gte('timestamp', filters.start_date);
      }
      
      if (filters.end_date) {
        query = query.lte('timestamp', filters.end_date);
      }
      
      query = query.order('timestamp', { ascending: false }).limit(limit);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[PerformanceMonitor] ❌ Failed to get metrics:', error.message);
      throw error;
    }
  }

  /**
   * Get metrics summary with aggregation
   */
  async getMetricsSummary(filters = {}) {
    try {
      const metrics = await this.getMetrics(filters, 1000);
      
      if (metrics.length === 0) {
        return {
          count: 0,
          avg_duration: 0,
          max_duration: 0,
          min_duration: 0,
          total_duration: 0
        };
      }
      
      const durations = metrics.map(m => m.duration_ms);
      
      return {
        count: metrics.length,
        avg_duration: durations.reduce((a, b) => a + b, 0) / durations.length,
        max_duration: Math.max(...durations),
        min_duration: Math.min(...durations),
        total_duration: durations.reduce((a, b) => a + b, 0)
      };
    } catch (error) {
      console.error('[PerformanceMonitor] ❌ Failed to get metrics summary:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup old metrics beyond retention period
   */
  async cleanupOldMetrics() {
    console.log(`[PerformanceMonitor] Cleaning up metrics older than ${this.retentionDays} days`);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const { error } = await this.supabase
        .from('performance_metrics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());
      
      if (error) throw error;
      
      console.log('[PerformanceMonitor] ✅ Old metrics cleaned up');
    } catch (error) {
      console.error('[PerformanceMonitor] ❌ Failed to cleanup metrics:', error.message);
      throw error;
    }
  }
}

module.exports = PerformanceMonitor;
