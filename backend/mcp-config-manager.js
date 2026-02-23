/**
 * MCP Configuration Manager
 * 
 * Manages MCP (Model Context Protocol) client configurations per project
 */

class MCPConfigManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Create MCP configuration
   */
  async createMCPConfig(projectId, config) {
    console.log(`[MCPConfigManager] Creating MCP config "${config.name}" for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .insert({
          project_id: projectId,
          name: config.name,
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          enabled: config.enabled !== undefined ? config.enabled : true,
          auto_approve: config.auto_approve || []
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ MCP config created: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to create MCP config:', error.message);
      throw error;
    }
  }

  /**
   * Get all MCP configurations for a project
   */
  async getMCPConfigs(projectId) {
    console.log(`[MCPConfigManager] Getting MCP configs for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .select('*')
        .eq('project_id', projectId)
        .order('name');
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ Found ${data.length} MCP configs`);
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to get MCP configs:', error.message);
      throw error;
    }
  }

  /**
   * Get enabled MCP configurations for a project
   */
  async getEnabledMCPConfigs(projectId) {
    console.log(`[MCPConfigManager] Getting enabled MCP configs for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .select('*')
        .eq('project_id', projectId)
        .eq('enabled', true)
        .order('name');
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ Found ${data.length} enabled MCP configs`);
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to get enabled MCP configs:', error.message);
      throw error;
    }
  }

  /**
   * Get a single MCP configuration
   */
  async getMCPConfig(configId) {
    console.log(`[MCPConfigManager] Getting MCP config ${configId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .select('*')
        .eq('id', configId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to get MCP config:', error.message);
      throw error;
    }
  }

  /**
   * Update MCP configuration
   */
  async updateMCPConfig(configId, updates) {
    console.log(`[MCPConfigManager] Updating MCP config ${configId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .update({
          ...updates,
          last_modified: new Date().toISOString()
        })
        .eq('id', configId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ MCP config updated`);
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to update MCP config:', error.message);
      throw error;
    }
  }

  /**
   * Toggle MCP configuration enabled status
   */
  async toggleMCPConfig(configId) {
    console.log(`[MCPConfigManager] Toggling MCP config ${configId}`);
    
    try {
      // Get current config
      const config = await this.getMCPConfig(configId);
      
      // Toggle enabled
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .update({
          enabled: !config.enabled,
          last_modified: new Date().toISOString()
        })
        .eq('id', configId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ MCP config toggled to ${data.enabled ? 'enabled' : 'disabled'}`);
      return data;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to toggle MCP config:', error.message);
      throw error;
    }
  }

  /**
   * Delete MCP configuration
   */
  async deleteMCPConfig(configId) {
    console.log(`[MCPConfigManager] Deleting MCP config ${configId}`);
    
    try {
      const { error } = await this.supabase
        .from('mcp_configurations')
        .delete()
        .eq('id', configId);
      
      if (error) throw error;
      
      console.log(`[MCPConfigManager] ✅ MCP config deleted`);
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to delete MCP config:', error.message);
      throw error;
    }
  }

  /**
   * Get MCP configuration by name
   */
  async getMCPConfigByName(projectId, name) {
    console.log(`[MCPConfigManager] Getting MCP config "${name}" for project ${projectId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('mcp_configurations')
        .select('*')
        .eq('project_id', projectId)
        .eq('name', name)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to get MCP config by name:', error.message);
      throw error;
    }
  }

  /**
   * Bulk update MCP configurations
   */
  async bulkUpdateMCPConfigs(projectId, configs) {
    console.log(`[MCPConfigManager] Bulk updating ${configs.length} MCP configs for project ${projectId}`);
    
    try {
      const results = [];
      
      for (const config of configs) {
        // Check if config exists
        const existing = await this.getMCPConfigByName(projectId, config.name);
        
        if (existing) {
          // Update existing
          const updated = await this.updateMCPConfig(existing.id, config);
          results.push(updated);
        } else {
          // Create new
          const created = await this.createMCPConfig(projectId, config);
          results.push(created);
        }
      }
      
      console.log(`[MCPConfigManager] ✅ Bulk update complete`);
      return results;
    } catch (error) {
      console.error('[MCPConfigManager] ❌ Failed to bulk update MCP configs:', error.message);
      throw error;
    }
  }
}

module.exports = MCPConfigManager;
