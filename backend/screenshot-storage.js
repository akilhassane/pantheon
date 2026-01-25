/**
 * Screenshot Storage Service
 * Handles storing and retrieving screenshots from Supabase
 */

class ScreenshotStorage {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Store a screenshot in the database
   * @param {Object} options - Screenshot options
   * @param {string} options.projectId - Project UUID
   * @param {string} options.sessionId - Session UUID (optional)
   * @param {string} options.imageData - Base64-encoded image data
   * @param {string} options.imagePath - File path where screenshot was saved (optional)
   * @param {string} options.description - AI-generated description (optional)
   * @param {Object} options.metadata - Additional metadata (optional)
   * @param {string} options.createdBy - User UUID (optional)
   * @returns {Promise<Object>} - Stored screenshot record
   */
  async storeScreenshot({ projectId, sessionId, imageData, imagePath, description, metadata = {}, createdBy }) {
    try {
      console.log(`📸 Storing screenshot for project: ${projectId}`);
      
      const { data, error } = await this.supabase
        .from('screenshots')
        .insert({
          project_id: projectId,
          session_id: sessionId || null,
          image_data: imageData,
          image_path: imagePath || null,
          description: description || null,
          metadata: metadata,
          created_by: createdBy || null
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to store screenshot:', error);
        throw error;
      }

      console.log(`✅ Screenshot stored with ID: ${data.id}`);
      return data;
    } catch (error) {
      console.error('❌ Error storing screenshot:', error.message);
      throw error;
    }
  }

  /**
   * Get screenshots for a project
   * @param {string} projectId - Project UUID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of screenshots to return
   * @param {number} options.offset - Number of screenshots to skip
   * @param {boolean} options.includeImageData - Whether to include base64 image data (default: false)
   * @returns {Promise<Array>} - Array of screenshot records
   */
  async getProjectScreenshots(projectId, { limit = 10, offset = 0, includeImageData = false } = {}) {
    try {
      console.log(`🔍 Fetching screenshots for project: ${projectId}`);
      
      let query = this.supabase
        .from('screenshots')
        .select(includeImageData ? '*' : 'id, project_id, session_id, image_path, description, metadata, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch screenshots:', error);
        throw error;
      }

      console.log(`✅ Found ${data.length} screenshots`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching screenshots:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific screenshot by ID
   * @param {string} screenshotId - Screenshot UUID
   * @param {boolean} includeImageData - Whether to include base64 image data (default: true)
   * @returns {Promise<Object>} - Screenshot record
   */
  async getScreenshot(screenshotId, includeImageData = true) {
    try {
      console.log(`🔍 Fetching screenshot: ${screenshotId}`);
      
      const { data, error } = await this.supabase
        .from('screenshots')
        .select(includeImageData ? '*' : 'id, project_id, session_id, image_path, description, metadata, created_at, created_by')
        .eq('id', screenshotId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch screenshot:', error);
        throw error;
      }

      console.log(`✅ Screenshot found`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching screenshot:', error.message);
      throw error;
    }
  }

  /**
   * Get the latest screenshot for a project
   * @param {string} projectId - Project UUID
   * @param {boolean} includeImageData - Whether to include base64 image data (default: true)
   * @returns {Promise<Object|null>} - Latest screenshot record or null
   */
  async getLatestScreenshot(projectId, includeImageData = true) {
    try {
      console.log(`🔍 Fetching latest screenshot for project: ${projectId}`);
      
      const { data, error } = await this.supabase
        .from('screenshots')
        .select(includeImageData ? '*' : 'id, project_id, session_id, image_path, description, metadata, created_at, created_by')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No screenshots found
          console.log('ℹ️  No screenshots found for project');
          return null;
        }
        console.error('❌ Failed to fetch latest screenshot:', error);
        throw error;
      }

      console.log(`✅ Latest screenshot found: ${data.id}`);
      return data;
    } catch (error) {
      console.error('❌ Error fetching latest screenshot:', error.message);
      throw error;
    }
  }

  /**
   * Update screenshot description (e.g., after AI analysis)
   * @param {string} screenshotId - Screenshot UUID
   * @param {string} description - AI-generated description
   * @returns {Promise<Object>} - Updated screenshot record
   */
  async updateDescription(screenshotId, description) {
    try {
      console.log(`📝 Updating description for screenshot: ${screenshotId}`);
      
      const { data, error } = await this.supabase
        .from('screenshots')
        .update({ description })
        .eq('id', screenshotId)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to update screenshot description:', error);
        throw error;
      }

      console.log(`✅ Description updated`);
      return data;
    } catch (error) {
      console.error('❌ Error updating screenshot description:', error.message);
      throw error;
    }
  }

  /**
   * Delete old screenshots for a project (keep only N most recent)
   * @param {string} projectId - Project UUID
   * @param {number} keepCount - Number of recent screenshots to keep
   * @returns {Promise<number>} - Number of screenshots deleted
   */
  async cleanupOldScreenshots(projectId, keepCount = 50) {
    try {
      console.log(`🧹 Cleaning up old screenshots for project: ${projectId} (keeping ${keepCount})`);
      
      // Get IDs of screenshots to keep
      const { data: keepScreenshots, error: fetchError } = await this.supabase
        .from('screenshots')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(keepCount);

      if (fetchError) {
        console.error('❌ Failed to fetch screenshots for cleanup:', fetchError);
        throw fetchError;
      }

      if (!keepScreenshots || keepScreenshots.length === 0) {
        console.log('ℹ️  No screenshots to clean up');
        return 0;
      }

      const keepIds = keepScreenshots.map(s => s.id);

      // Delete screenshots not in the keep list
      const { data, error: deleteError } = await this.supabase
        .from('screenshots')
        .delete()
        .eq('project_id', projectId)
        .not('id', 'in', `(${keepIds.join(',')})`)
        .select('id');

      if (deleteError) {
        console.error('❌ Failed to delete old screenshots:', deleteError);
        throw deleteError;
      }

      const deletedCount = data ? data.length : 0;
      console.log(`✅ Deleted ${deletedCount} old screenshots`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up screenshots:', error.message);
      throw error;
    }
  }
}

module.exports = ScreenshotStorage;
