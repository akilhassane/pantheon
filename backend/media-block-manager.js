/**
 * Media Block Manager
 * 
 * Manages media blocks (code, files, images, charts, etc.) in chat messages
 */

class MediaBlockManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
  }

  /**
   * Save media blocks for a message (batch insert)
   */
  async saveMediaBlocks(messageId, blocks) {
    if (!blocks || blocks.length === 0) {
      return [];
    }
    
    console.log(`[MediaBlockManager] Saving ${blocks.length} media blocks for message ${messageId}`);
    
    try {
      // Prepare blocks for insertion
      const blocksToInsert = blocks.map((block, index) => ({
        message_id: messageId,
        type: block.type,
        data: block.data,
        sequence_order: block.sequence_order !== undefined ? block.sequence_order : index
      }));
      
      const { data, error } = await this.supabase
        .from('media_blocks')
        .insert(blocksToInsert)
        .select();
      
      if (error) throw error;
      
      console.log(`[MediaBlockManager] ✅ Saved ${data.length} media blocks`);
      return data;
    } catch (error) {
      console.error('[MediaBlockManager] ❌ Failed to save media blocks:', error.message);
      throw error;
    }
  }

  /**
   * Get media blocks for a message (with ordering)
   */
  async getMediaBlocks(messageId) {
    console.log(`[MediaBlockManager] Getting media blocks for message ${messageId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('media_blocks')
        .select('*')
        .eq('message_id', messageId)
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      
      console.log(`[MediaBlockManager] ✅ Found ${data.length} media blocks`);
      return data;
    } catch (error) {
      console.error('[MediaBlockManager] ❌ Failed to get media blocks:', error.message);
      throw error;
    }
  }

  /**
   * Get media blocks for multiple messages
   */
  async getMediaBlocksForMessages(messageIds) {
    if (!messageIds || messageIds.length === 0) {
      return [];
    }
    
    console.log(`[MediaBlockManager] Getting media blocks for ${messageIds.length} messages`);
    
    try {
      const { data, error } = await this.supabase
        .from('media_blocks')
        .select('*')
        .in('message_id', messageIds)
        .order('message_id')
        .order('sequence_order', { ascending: true });
      
      if (error) throw error;
      
      console.log(`[MediaBlockManager] ✅ Found ${data.length} media blocks`);
      return data;
    } catch (error) {
      console.error('[MediaBlockManager] ❌ Failed to get media blocks:', error.message);
      throw error;
    }
  }

  /**
   * Delete media blocks for a message
   */
  async deleteMediaBlocks(messageId) {
    console.log(`[MediaBlockManager] Deleting media blocks for message ${messageId}`);
    
    try {
      const { error } = await this.supabase
        .from('media_blocks')
        .delete()
        .eq('message_id', messageId);
      
      if (error) throw error;
      
      console.log(`[MediaBlockManager] ✅ Media blocks deleted`);
    } catch (error) {
      console.error('[MediaBlockManager] ❌ Failed to delete media blocks:', error.message);
      throw error;
    }
  }

  /**
   * Update a media block
   */
  async updateMediaBlock(blockId, updates) {
    console.log(`[MediaBlockManager] Updating media block ${blockId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('media_blocks')
        .update(updates)
        .eq('id', blockId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[MediaBlockManager] ✅ Media block updated`);
      return data;
    } catch (error) {
      console.error('[MediaBlockManager] ❌ Failed to update media block:', error.message);
      throw error;
    }
  }
}

module.exports = MediaBlockManager;
