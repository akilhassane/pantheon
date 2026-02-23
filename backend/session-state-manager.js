/**
 * Session State Manager
 * 
 * Manages session states for CRUD operation restoration
 */

class SessionStateManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Save a session state
   */
  async saveSessionState(sessionId, crudOperations, snapshot = null) {
    console.log(`[SessionStateManager] Saving state for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('session_states')
        .insert({
          session_id: sessionId,
          crud_operations: crudOperations,
          snapshot
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[SessionStateManager] ✅ Session state saved: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[SessionStateManager] ❌ Failed to save session state:', error.message);
      throw error;
    }
  }

  /**
   * Get session states (with ordering)
   */
  async getSessionStates(sessionId, limit = 50) {
    console.log(`[SessionStateManager] Getting states for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('session_states')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      console.log(`[SessionStateManager] ✅ Found ${data.length} session states`);
      return data;
    } catch (error) {
      console.error('[SessionStateManager] ❌ Failed to get session states:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific session state by ID
   */
  async getSessionStateById(stateId) {
    console.log(`[SessionStateManager] Getting session state ${stateId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('session_states')
        .select('*')
        .eq('id', stateId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[SessionStateManager] ❌ Failed to get session state:', error.message);
      throw error;
    }
  }

  /**
   * Delete session states
   */
  async deleteSessionStates(sessionId) {
    console.log(`[SessionStateManager] Deleting states for session ${sessionId}`);
    
    try {
      const { error } = await this.supabase
        .from('session_states')
        .delete()
        .eq('session_id', sessionId);
      
      if (error) throw error;
      
      console.log(`[SessionStateManager] ✅ Session states deleted`);
    } catch (error) {
      console.error('[SessionStateManager] ❌ Failed to delete session states:', error.message);
      throw error;
    }
  }

  /**
   * Get latest session state
   */
  async getLatestSessionState(sessionId) {
    console.log(`[SessionStateManager] Getting latest state for session ${sessionId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('session_states')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('[SessionStateManager] ❌ Failed to get latest session state:', error.message);
      throw error;
    }
  }
}

module.exports = SessionStateManager;
