/**
 * Screenshot Bucket Service
 * Handles fetching screenshots from per-project Supabase storage buckets
 */

class ScreenshotBucketService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get bucket name for a project
   * @param {string} projectId - Project UUID
   * @returns {string} - Bucket name
   */
  getBucketName(projectId) {
    return `screenshots-${projectId}`;
  }

  /**
   * List all screenshots in a project's bucket
   * @param {string} projectId - Project UUID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of screenshots to return
   * @param {number} options.offset - Number of screenshots to skip
   * @returns {Promise<Array>} - Array of file objects with public URLs
   */
  async listScreenshots(projectId, { limit = 20, offset = 0 } = {}) {
    try {
      const bucketName = this.getBucketName(projectId);
      console.log(`📸 Listing screenshots from bucket: ${bucketName}`);

      const { data, error } = await this.supabase
        .storage
        .from(bucketName)
        .list('', {
          limit,
          offset,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error(`❌ Failed to list screenshots:`, error);
        throw error;
      }

      // Add public URLs to each file
      const screenshots = data.map(file => {
        const { data: urlData } = this.supabase
          .storage
          .from(bucketName)
          .getPublicUrl(file.name);

        return {
          name: file.name,
          size: file.metadata?.size || 0,
          createdAt: file.created_at,
          updatedAt: file.updated_at,
          publicUrl: urlData.publicUrl
        };
      });

      console.log(`✅ Found ${screenshots.length} screenshots`);
      return screenshots;
    } catch (error) {
      console.error(`❌ Error listing screenshots:`, error.message);
      throw error;
    }
  }

  /**
   * Get the latest screenshot for a project
   * @param {string} projectId - Project UUID
   * @returns {Promise<Object|null>} - Latest screenshot with public URL or null
   */
  async getLatestScreenshot(projectId) {
    try {
      const screenshots = await this.listScreenshots(projectId, { limit: 1 });
      return screenshots.length > 0 ? screenshots[0] : null;
    } catch (error) {
      console.error(`❌ Error getting latest screenshot:`, error.message);
      return null;
    }
  }

  /**
   * Get public URL for a specific screenshot
   * @param {string} projectId - Project UUID
   * @param {string} fileName - Screenshot file name
   * @returns {string} - Public URL
   */
  getPublicUrl(projectId, fileName) {
    const bucketName = this.getBucketName(projectId);
    const { data } = this.supabase
      .storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  /**
   * Download screenshot as base64
   * @param {string} projectId - Project UUID
   * @param {string} fileName - Screenshot file name
   * @returns {Promise<string>} - Base64-encoded image data
   */
  async downloadAsBase64(projectId, fileName) {
    try {
      const bucketName = this.getBucketName(projectId);
      console.log(`📥 Downloading screenshot: ${fileName} from ${bucketName}`);

      const { data, error } = await this.supabase
        .storage
        .from(bucketName)
        .download(fileName);

      if (error) {
        console.error(`❌ Failed to download screenshot:`, error);
        throw error;
      }

      // Convert blob to base64
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');

      console.log(`✅ Downloaded screenshot (${(base64.length / 1024).toFixed(2)} KB)`);
      return base64;
    } catch (error) {
      console.error(`❌ Error downloading screenshot:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a project's bucket exists
   * @param {string} projectId - Project UUID
   * @returns {Promise<boolean>} - True if bucket exists
   */
  async bucketExists(projectId) {
    try {
      const bucketName = this.getBucketName(projectId);
      const { data, error } = await this.supabase
        .storage
        .getBucket(bucketName);

      return !error && data !== null;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ScreenshotBucketService;
