/**
 * Execution Context Manager
 * 
 * Manages session execution contexts (working directory, tmux session, environment vars)
 */

class ExecutionContextManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Save execution context for a session
   */
  async saveExecutionContext(sessionId, context) {
    console.log(`[ExecutionContextManager] Saving context for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('execution_contexts')
        .upsert({
          session_id: sessionId,
          working_directory: context.working_directory || '/workspace',
          tmux_session_id: context.tmux_session_id || null,
          environment_vars: context.environment_vars || {},
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ExecutionContextManager] ✅ Context saved`);
      return data;
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to save context:', error.message);
      throw error;
    }
  }

  /**
   * Get execution context for a session
   */
  async getExecutionContext(sessionId) {
    console.log(`[ExecutionContextManager] Getting context for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('execution_contexts')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }
      
      // Return default context if not found
      if (!data) {
        return {
          session_id: sessionId,
          working_directory: '/workspace',
          tmux_session_id: null,
          environment_vars: {}
        };
      }
      
      return data;
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to get context:', error.message);
      throw error;
    }
  }

  /**
   * Update working directory
   */
  async updateWorkingDirectory(sessionId, workingDirectory) {
    console.log(`[ExecutionContextManager] Updating working directory for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('execution_contexts')
        .upsert({
          session_id: sessionId,
          working_directory: workingDirectory,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ExecutionContextManager] ✅ Working directory updated`);
      return data;
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to update working directory:', error.message);
      throw error;
    }
  }

  /**
   * Update tmux session ID
   */
  async updateTmuxSession(sessionId, tmuxSessionId) {
    console.log(`[ExecutionContextManager] Updating tmux session for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('execution_contexts')
        .upsert({
          session_id: sessionId,
          tmux_session_id: tmuxSessionId,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ExecutionContextManager] ✅ Tmux session updated`);
      return data;
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to update tmux session:', error.message);
      throw error;
    }
  }

  /**
   * Update environment variables
   */
  async updateEnvironmentVars(sessionId, envVars) {
    console.log(`[ExecutionContextManager] Updating environment vars for session ${sessionId}`);
    
    try {
      // Get existing context
      const existing = await this.getExecutionContext(sessionId);
      
      // Merge environment variables
      const merged = {
        ...existing.environment_vars,
        ...envVars
      };
      
      const { data, error } = await this.supabase
        .from('execution_contexts')
        .upsert({
          session_id: sessionId,
          environment_vars: merged,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ExecutionContextManager] ✅ Environment vars updated`);
      return data;
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to update environment vars:', error.message);
      throw error;
    }
  }

  /**
   * Delete execution context
   */
  async deleteExecutionContext(sessionId) {
    console.log(`[ExecutionContextManager] Deleting context for session ${sessionId}`);
    
    try {
      const { error } = await this.supabase
        .from('execution_contexts')
        .delete()
        .eq('session_id', sessionId);
      
      if (error) throw error;
      
      console.log(`[ExecutionContextManager] ✅ Context deleted`);
    } catch (error) {
      console.error('[ExecutionContextManager] ❌ Failed to delete context:', error.message);
      throw error;
    }
  }
}

module.exports = ExecutionContextManager;
