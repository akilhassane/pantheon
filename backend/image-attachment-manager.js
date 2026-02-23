/**
 * Image Attachment Manager
 * 
 * Manages image attachments with Supabase Storage integration
 */

const path = require('path');
const crypto = require('crypto');

class ImageAttachmentManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('Supabase client is required');
    }
    this.supabase = supabaseClient;
    this.bucketName = 'chat-images';
  }

  /**
   * Initialize storage bucket
   */
  async initializeBucket() {
    try {
      // Check if bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {
        // Create bucket
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: false,
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (error) throw error;
        console.log(`[ImageAttachmentManager] ✅ Created storage bucket: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to initialize bucket:', error.message);
      // Don't throw - bucket might already exist
    }
  }

  /**
   * Upload an image to Supabase Storage
   */
  async uploadImage(messageId, imageBuffer, filename, mimeType = 'image/png') {
    console.log(`[ImageAttachmentManager] Uploading image for message ${messageId}`);
    
    try {
      // Generate unique filename
      const ext = path.extname(filename) || '.png';
      const hash = crypto.randomBytes(16).toString('hex');
      const storagePath = `${messageId}/${hash}${ext}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(storagePath, imageBuffer, {
          contentType: mimeType,
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(storagePath);
      
      const url = urlData.publicUrl;
      
      // Insert record into database
      const { data, error } = await this.supabase
        .from('image_attachments')
        .insert({
          message_id: messageId,
          storage_path: storagePath,
          url,
          mime_type: mimeType,
          file_size: imageBuffer.length,
          alt_text: filename
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ImageAttachmentManager] ✅ Image uploaded: ${data.id}`);
      return data;
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to upload image:', error.message);
      throw error;
    }
  }

  /**
   * Get image attachments for a message
   */
  async getImageAttachments(messageId) {
    console.log(`[ImageAttachmentManager] Getting images for message ${messageId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('image_attachments')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log(`[ImageAttachmentManager] ✅ Found ${data.length} images`);
      return data;
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to get images:', error.message);
      throw error;
    }
  }

  /**
   * Get signed URL for an image (for private access)
   */
  async getImageUrl(attachmentId, expiresIn = 3600) {
    console.log(`[ImageAttachmentManager] Getting signed URL for attachment ${attachmentId}`);
    
    try {
      // Get attachment record
      const { data: attachment, error: fetchError } = await this.supabase
        .from('image_attachments')
        .select('storage_path')
        .eq('id', attachmentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Get signed URL
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(attachment.storage_path, expiresIn);
      
      if (error) throw error;
      
      return data.signedUrl;
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to get signed URL:', error.message);
      throw error;
    }
  }

  /**
   * Delete an image attachment
   */
  async deleteImageAttachment(attachmentId) {
    console.log(`[ImageAttachmentManager] Deleting attachment ${attachmentId}`);
    
    try {
      // Get attachment record
      const { data: attachment, error: fetchError } = await this.supabase
        .from('image_attachments')
        .select('storage_path')
        .eq('id', attachmentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove([attachment.storage_path]);
      
      if (storageError) {
        console.warn('[ImageAttachmentManager] ⚠️  Failed to delete from storage:', storageError.message);
      }
      
      // Delete from database
      const { error: dbError } = await this.supabase
        .from('image_attachments')
        .delete()
        .eq('id', attachmentId);
      
      if (dbError) throw dbError;
      
      console.log(`[ImageAttachmentManager] ✅ Image attachment deleted`);
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to delete image:', error.message);
      throw error;
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(attachmentId, metadata) {
    console.log(`[ImageAttachmentManager] Updating metadata for attachment ${attachmentId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('image_attachments')
        .update(metadata)
        .eq('id', attachmentId)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[ImageAttachmentManager] ✅ Metadata updated`);
      return data;
    } catch (error) {
      console.error('[ImageAttachmentManager] ❌ Failed to update metadata:', error.message);
      throw error;
    }
  }
}

module.exports = ImageAttachmentManager;
