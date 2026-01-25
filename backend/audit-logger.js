/**
 * Audit Logger
 * 
 * Logs security-relevant events to partitioned audit_logs table
 */

class AuditLogger {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
    this.retentionDays = 90; // Minimum retention period
  }

  /**
   * Log an audit event
   */
  async log(entry) {
    try {
      const { data, error } = await this.supabase
        .from('audit_logs')
        .insert({
          user_id: entry.user_id,
          action_type: entry.action_type,
          resource_type: entry.resource_type || null,
          resource_id: entry.resource_id || null,
          details: entry.details || null,
          ip_address: entry.ip_address || null,
          user_agent: entry.user_agent || null,
          result: entry.result
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[AuditLogger] ❌ Failed to log audit event:', error.message);
      // Don't throw - audit logging shouldn't break the app
      return null;
    }
  }

  /**
   * Query audit logs with filtering
   */
  async queryAuditLogs(filters = {}, limit = 100) {
    try {
      let query = this.supabase
        .from('audit_logs')
        .select('*');
      
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      
      if (filters.action_type) {
        query = query.eq('action_type', filters.action_type);
      }
      
      if (filters.resource_type) {
        query = query.eq('resource_type', filters.resource_type);
      }
      
      if (filters.resource_id) {
        query = query.eq('resource_id', filters.resource_id);
      }
      
      if (filters.result) {
        query = query.eq('result', filters.result);
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
      console.error('[AuditLogger] ❌ Failed to query audit logs:', error.message);
      throw error;
    }
  }

  /**
   * Get user's own audit logs
   */
  async getUserAuditLogs(userId, limit = 100) {
    return await this.queryAuditLogs({ user_id: userId }, limit);
  }

  /**
   * Cleanup old audit logs (respecting minimum retention)
   */
  async cleanupOldAuditLogs() {
    console.log(`[AuditLogger] Cleaning up audit logs older than ${this.retentionDays} days`);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      const { error } = await this.supabase
        .from('audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());
      
      if (error) throw error;
      
      console.log('[AuditLogger] ✅ Old audit logs cleaned up');
    } catch (error) {
      console.error('[AuditLogger] ❌ Failed to cleanup audit logs:', error.message);
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(userId, action, result, ipAddress = null, userAgent = null) {
    return await this.log({
      user_id: userId,
      action_type: `auth_${action}`,
      result,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  /**
   * Log project operation
   */
  async logProjectOperation(userId, action, projectId, result, details = null) {
    return await this.log({
      user_id: userId,
      action_type: `project_${action}`,
      resource_type: 'project',
      resource_id: projectId,
      result,
      details
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(userId, action, result, details = null) {
    return await this.log({
      user_id: userId,
      action_type: `security_${action}`,
      result,
      details
    });
  }
}

module.exports = AuditLogger;
