/**
 * User Settings Routes
 * 
 * Handles user-specific settings stored in PostgreSQL
 * Settings include: models, modes, appearance, behavior, etc.
 */

const express = require('express');
const router = express.Router();

/**
 * Setup user settings routes
 * @param {Object} supabase - Supabase/PostgreSQL client
 * @returns {express.Router} Express router
 */
function setupUserSettingsRoutes(supabase) {
  
  /**
   * GET /api/user-settings/:userId
   * Get all settings for a user
   */
  router.get('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      // If no settings exist, return defaults
      if (!data) {
        return res.json({
          success: true,
          settings: {
            selected_model: null,
            default_model: null,
            visible_models: [],
            selected_mode: null,
            default_mode: null,
            theme: 'dark',
            sidebar_position: 'left',
            chat_position: 'right',
            auto_run_code: false,
            show_line_numbers: true,
            enable_sound: false,
            custom_settings: {}
          },
          isDefault: true
        });
      }

      res.json({
        success: true,
        settings: data,
        isDefault: false
      });

    } catch (error) {
      console.error('[UserSettings] Error getting settings:', error.message);
      res.status(500).json({
        error: 'GET_SETTINGS_FAILED',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/user-settings/:userId
   * Update settings for a user (upsert)
   */
  router.put('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = req.body;

      console.log('[UserSettings] PUT request for user:', userId);
      console.log('[UserSettings] Received settings:', JSON.stringify(settings, null, 2));

      // Prepare settings for database (stringify JSON fields)
      const dbSettings = {
        ...settings,
        // Stringify JSON fields if they are objects
        visible_models: Array.isArray(settings.visible_models) 
          ? settings.visible_models 
          : (settings.visible_models || []),
        custom_modes: Array.isArray(settings.custom_modes)
          ? settings.custom_modes
          : (settings.custom_modes || []),
        custom_settings: typeof settings.custom_settings === 'object'
          ? settings.custom_settings
          : (settings.custom_settings || {})
      };

      console.log('[UserSettings] Prepared dbSettings:', JSON.stringify(dbSettings, null, 2));

      // Check if settings exist
      const { data: existing, error: existingError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('[UserSettings] Error checking existing settings:', existingError);
        throw existingError;
      }

      console.log('[UserSettings] Existing settings:', existing ? 'found' : 'not found');

      let result;
      if (existing) {
        // Update existing settings
        console.log('[UserSettings] Updating existing settings...');
        result = await supabase
          .from('user_settings')
          .update({
            ...dbSettings,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Insert new settings
        console.log('[UserSettings] Inserting new settings...');
        result = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            ...dbSettings
          })
          .select()
          .single();
      }

      console.log('[UserSettings] Result error:', result.error);
      console.log('[UserSettings] Result data:', result.data ? 'present' : 'null');

      if (result.error) {
        console.error('[UserSettings] Supabase error details:', JSON.stringify(result.error, null, 2));
        throw result.error;
      }

      res.json({
        success: true,
        settings: result.data
      });

    } catch (error) {
      console.error('[UserSettings] Error updating settings:', error.message);
      console.error('[UserSettings] Error details:', JSON.stringify(error, null, 2));
      res.status(500).json({
        error: 'UPDATE_SETTINGS_FAILED',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/user-settings/:userId
   * Partially update settings for a user
   */
  router.patch('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const partialSettings = req.body;

      // Prepare settings for database (stringify JSON fields)
      const dbSettings = {
        ...partialSettings,
        // Stringify JSON fields if they are objects
        visible_models: Array.isArray(partialSettings.visible_models) 
          ? partialSettings.visible_models 
          : undefined,
        custom_modes: Array.isArray(partialSettings.custom_modes)
          ? partialSettings.custom_modes
          : undefined,
        custom_settings: typeof partialSettings.custom_settings === 'object'
          ? partialSettings.custom_settings
          : undefined
      };

      // Remove undefined values
      Object.keys(dbSettings).forEach(key => {
        if (dbSettings[key] === undefined) {
          delete dbSettings[key];
        }
      });

      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      let result;
      if (existing) {
        // Update existing settings (merge with existing)
        result = await supabase
          .from('user_settings')
          .update({
            ...dbSettings,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Insert new settings
        result = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            ...dbSettings
          })
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      res.json({
        success: true,
        settings: result.data
      });

    } catch (error) {
      console.error('[UserSettings] Error patching settings:', error.message);
      console.error('[UserSettings] Error details:', error);
      res.status(500).json({
        error: 'PATCH_SETTINGS_FAILED',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = setupUserSettingsRoutes;
