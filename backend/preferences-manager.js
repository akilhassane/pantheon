/**
 * Preferences Manager
 * 
 * Manages user preferences and settings
 */

class PreferencesManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
    
    // Default preferences
    this.defaultPreferences = {
      theme: 'dark',
      fontSize: 14,
      defaultModel: 'gemini-2.5-flash',
      autoSave: true,
      notifications: {
        email: true,
        push: false,
        collaboration: true
      },
      editor: {
        tabSize: 2,
        wordWrap: true,
        minimap: false
      }
    };
  }

  /**
   * Get user preferences (with defaults)
   */
  async getUserPreferences(userId) {
    console.log(`[PreferencesManager] Getting preferences for user ${userId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }
      
      // Merge with defaults
      const userPrefs = data?.preferences || {};
      const merged = this._mergePreferences(this.defaultPreferences, userPrefs);
      
      console.log(`[PreferencesManager] ✅ Preferences retrieved`);
      return merged;
    } catch (error) {
      console.error('[PreferencesManager] ❌ Failed to get preferences:', error.message);
      throw error;
    }
  }

  /**
   * Update user preferences (upsert)
   */
  async updatePreferences(userId, preferences) {
    console.log(`[PreferencesManager] Updating preferences for user ${userId}`);
    
    try {
      // Get existing preferences
      const existing = await this.getUserPreferences(userId);
      
      // Merge with new preferences
      const updated = this._mergePreferences(existing, preferences);
      
      // Upsert
      const { data, error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          preferences: updated,
          last_modified: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[PreferencesManager] ✅ Preferences updated`);
      return data.preferences;
    } catch (error) {
      console.error('[PreferencesManager] ❌ Failed to update preferences:', error.message);
      throw error;
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId) {
    console.log(`[PreferencesManager] Resetting preferences for user ${userId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          preferences: this.defaultPreferences,
          last_modified: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[PreferencesManager] ✅ Preferences reset to defaults`);
      return data.preferences;
    } catch (error) {
      console.error('[PreferencesManager] ❌ Failed to reset preferences:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific preference value
   */
  async getPreference(userId, key) {
    const preferences = await this.getUserPreferences(userId);
    return this._getNestedValue(preferences, key);
  }

  /**
   * Set a specific preference value
   */
  async setPreference(userId, key, value) {
    const preferences = await this.getUserPreferences(userId);
    this._setNestedValue(preferences, key, value);
    return await this.updatePreferences(userId, preferences);
  }

  /**
   * Merge preferences (deep merge)
   */
  _mergePreferences(defaults, overrides) {
    const result = { ...defaults };
    
    for (const key in overrides) {
      if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
        result[key] = this._mergePreferences(defaults[key] || {}, overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    
    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, key) {
    return key.split('.').reduce((o, k) => (o || {})[k], obj);
  }

  /**
   * Set nested value in object using dot notation
   */
  _setNestedValue(obj, key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((o, k) => {
      if (!o[k]) o[k] = {};
      return o[k];
    }, obj);
    target[lastKey] = value;
  }
}

module.exports = PreferencesManager;
