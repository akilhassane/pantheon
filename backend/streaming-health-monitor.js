/**
 * Streaming Health Monitor
 * Prevents hanging streams by implementing timeouts, heartbeats, and connection monitoring
 */

class StreamingHealthMonitor {
  constructor() {
    this.activeStreams = new Map();
    this.config = {
      heartbeatInterval: 15000,      // Send heartbeat every 15 seconds
      inactivityTimeout: 30000,      // Kill stream after 30 seconds of no activity
      maxStreamDuration: 1800000,    // Max 30 minutes per stream
      connectionCheckInterval: 5000  // Check connection health every 5 seconds
    };
  }

  /**
   * Register a new streaming response
   */
  registerStream(streamId, res, metadata = {}) {
    console.log(`[StreamHealth] 📡 Registering stream: ${streamId}`);
    
    const stream = {
      id: streamId,
      res,
      metadata,
      startTime: Date.now(),
      lastActivity: Date.now(),
      heartbeatTimer: null,
      inactivityTimer: null,
      maxDurationTimer: null,
      isActive: true,
      bytesSent: 0,
      messagesSent: 0
    };

    // Set up heartbeat
    stream.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(streamId);
    }, this.config.heartbeatInterval);

    // Set up inactivity timeout
    this.resetInactivityTimer(streamId, stream);

    // Set up max duration timeout
    stream.maxDurationTimer = setTimeout(() => {
      console.log(`[StreamHealth] ⏰ Stream ${streamId} exceeded max duration, terminating`);
      this.terminateStream(streamId, 'max_duration_exceeded');
    }, this.config.maxStreamDuration);

    // Monitor connection health
    stream.connectionCheckTimer = setInterval(() => {
      this.checkConnectionHealth(streamId);
    }, this.config.connectionCheckInterval);

    this.activeStreams.set(streamId, stream);
    
    console.log(`[StreamHealth] ✅ Stream registered: ${streamId} (Total active: ${this.activeStreams.size})`);
  }

  /**
   * Update stream activity (call this whenever data is sent)
   */
  updateActivity(streamId, bytesAdded = 0) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || !stream.isActive) return;

    stream.lastActivity = Date.now();
    stream.bytesSent += bytesAdded;
    stream.messagesSent++;

    // Reset inactivity timer
    this.resetInactivityTimer(streamId, stream);
  }

  /**
   * Reset the inactivity timeout
   */
  resetInactivityTimer(streamId, stream) {
    if (stream.inactivityTimer) {
      clearTimeout(stream.inactivityTimer);
    }

    stream.inactivityTimer = setTimeout(() => {
      const inactiveTime = Date.now() - stream.lastActivity;
      console.log(`[StreamHealth] ⚠️  Stream ${streamId} inactive for ${inactiveTime}ms, terminating`);
      this.terminateStream(streamId, 'inactivity_timeout');
    }, this.config.inactivityTimeout);
  }

  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || !stream.isActive) return;

    try {
      const heartbeat = JSON.stringify({ 
        type: 'heartbeat', 
        timestamp: Date.now(),
        streamId: streamId
      });
      
      stream.res.write(`0:${heartbeat}\n`);
      
      // Don't count heartbeat as activity (to detect real inactivity)
      // But do update bytes sent
      stream.bytesSent += heartbeat.length;
      
    } catch (error) {
      console.error(`[StreamHealth] ❌ Failed to send heartbeat for ${streamId}:`, error.message);
      this.terminateStream(streamId, 'heartbeat_failed');
    }
  }

  /**
   * Check if the connection is still healthy
   */
  checkConnectionHealth(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || !stream.isActive) return;

    // Check if response is still writable
    if (stream.res.destroyed || stream.res.writableEnded) {
      console.log(`[StreamHealth] 🔌 Stream ${streamId} connection closed by client`);
      this.terminateStream(streamId, 'client_disconnected');
      return;
    }

    // Check for suspiciously long streams with no data
    const duration = Date.now() - stream.startTime;
    if (duration > 30000 && stream.messagesSent === 0) {
      console.log(`[StreamHealth] ⚠️  Stream ${streamId} running for ${duration}ms with no messages`);
      this.terminateStream(streamId, 'no_data_sent');
    }
  }

  /**
   * Terminate a stream gracefully
   */
  terminateStream(streamId, reason = 'unknown') {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    console.log(`[StreamHealth] 🛑 Terminating stream ${streamId} (reason: ${reason})`);

    stream.isActive = false;

    // Clear all timers
    if (stream.heartbeatTimer) clearInterval(stream.heartbeatTimer);
    if (stream.inactivityTimer) clearTimeout(stream.inactivityTimer);
    if (stream.maxDurationTimer) clearTimeout(stream.maxDurationTimer);
    if (stream.connectionCheckTimer) clearInterval(stream.connectionCheckTimer);

    // Send termination message if possible
    try {
      if (!stream.res.destroyed && !stream.res.writableEnded) {
        // Send error message for unexpected terminations
        const errorReasons = ['inactivity_timeout', 'heartbeat_failed', 'no_data_sent', 'stream_error', 'request_error'];
        if (errorReasons.includes(reason)) {
          stream.res.write(`0:${JSON.stringify({ 
            type: 'text-delta', 
            textDelta: '\n\nNetwork error: The connection was interrupted. Please try again.' 
          })}\n`);
        }
        
        stream.res.write(`0:${JSON.stringify({ 
          type: 'stream-terminated', 
          reason,
          duration: Date.now() - stream.startTime,
          messagesSent: stream.messagesSent
        })}\n`);
        
        stream.res.write(`0:${JSON.stringify({ type: 'done' })}\n`);
        stream.res.end();
      }
    } catch (error) {
      console.error(`[StreamHealth] ❌ Error terminating stream ${streamId}:`, error.message);
    }

    // Log stats
    const duration = Date.now() - stream.startTime;
    console.log(`[StreamHealth] 📊 Stream ${streamId} stats:`, {
      duration: `${(duration / 1000).toFixed(2)}s`,
      messagesSent: stream.messagesSent,
      bytesSent: stream.bytesSent,
      reason
    });

    this.activeStreams.delete(streamId);
    console.log(`[StreamHealth] ✅ Stream ${streamId} cleaned up (Active streams: ${this.activeStreams.size})`);
  }

  /**
   * Manually complete a stream (call when done successfully)
   */
  completeStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    console.log(`[StreamHealth] ✅ Stream ${streamId} completed successfully`);
    
    // Clear timers but don't send termination message (already sent 'done')
    stream.isActive = false;
    if (stream.heartbeatTimer) clearInterval(stream.heartbeatTimer);
    if (stream.inactivityTimer) clearTimeout(stream.inactivityTimer);
    if (stream.maxDurationTimer) clearTimeout(stream.maxDurationTimer);
    if (stream.connectionCheckTimer) clearInterval(stream.connectionCheckTimer);

    const duration = Date.now() - stream.startTime;
    console.log(`[StreamHealth] 📊 Stream ${streamId} completed:`, {
      duration: `${(duration / 1000).toFixed(2)}s`,
      messagesSent: stream.messagesSent,
      bytesSent: stream.bytesSent
    });

    this.activeStreams.delete(streamId);
  }

  /**
   * Get stats for all active streams
   */
  getStats() {
    const stats = {
      activeStreams: this.activeStreams.size,
      streams: []
    };

    for (const [id, stream] of this.activeStreams.entries()) {
      const duration = Date.now() - stream.startTime;
      const inactiveTime = Date.now() - stream.lastActivity;
      
      stats.streams.push({
        id,
        duration: `${(duration / 1000).toFixed(2)}s`,
        inactiveTime: `${(inactiveTime / 1000).toFixed(2)}s`,
        messagesSent: stream.messagesSent,
        bytesSent: stream.bytesSent,
        isActive: stream.isActive,
        metadata: stream.metadata
      });
    }

    return stats;
  }

  /**
   * Cleanup all streams (for shutdown)
   */
  cleanup() {
    console.log(`[StreamHealth] 🧹 Cleaning up ${this.activeStreams.size} active streams`);
    
    for (const streamId of this.activeStreams.keys()) {
      this.terminateStream(streamId, 'server_shutdown');
    }
  }
}

// Singleton instance
const streamHealthMonitor = new StreamingHealthMonitor();

// Cleanup on process exit
process.on('SIGINT', () => {
  streamHealthMonitor.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  streamHealthMonitor.cleanup();
  process.exit(0);
});

module.exports = streamHealthMonitor;
