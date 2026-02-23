/**
 * Usage Tracking Module
 * Tracks API usage, token consumption, and costs per model
 */

const { getSupabaseAdmin } = require('./config/supabase-client');

const supabase = getSupabaseAdmin();

/**
 * Track a single API request
 */
async function trackUsage(data) {
  try {
    const {
      userId,
      modelId,
      provider,
      promptTokens = 0,
      completionTokens = 0,
      reasoningTokens = 0,
      totalTokens = 0,
      cost = 0,
      sessionId = null,
      projectId = null
    } = data;

    const { data: record, error } = await supabase
      .from('model_usage')
      .insert({
        user_id: userId,
        model_id: modelId,
        provider: provider,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        reasoning_tokens: reasoningTokens,
        total_tokens: totalTokens,
        estimated_cost: cost,
        session_id: sessionId,
        project_id: projectId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error tracking usage:', error);
      return null;
    }

    console.log(`✅ Usage tracked: ${modelId} - ${totalTokens} tokens`);
    return record;
  } catch (error) {
    console.error('❌ Error in trackUsage:', error);
    return null;
  }
}

/**
 * Get usage statistics for a user
 */
async function getUserUsage(userId, options = {}) {
  try {
    const {
      modelId = null,
      startDate = null,
      endDate = null,
      limit = 100
    } = options;

    let query = supabase
      .from('model_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching usage:', error);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('❌ Error in getUserUsage:', error);
    return { error: error.message };
  }
}

/**
 * Get aggregated usage statistics
 */
async function getUsageStats(userId, options = {}) {
  try {
    const {
      modelId = null,
      startDate = null,
      endDate = null,
      groupBy = 'day' // 'day', 'week', 'month'
    } = options;

    console.log('📊 getUsageStats called with:', { userId, modelId, startDate, endDate, groupBy });

    // Build the query
    let query = supabase
      .from('model_usage')
      .select('*')
      .eq('user_id', userId);

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    // Only apply date filters if they are provided
    // Note: Supabase uses ISO 8601 format for timestamps
    if (startDate) {
      console.log('📅 Filtering by startDate:', startDate);
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      console.log('📅 Filtering by endDate:', endDate);
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    
    console.log('📊 Query result:', { 
      rowCount: data?.length || 0, 
      error: error?.message || null,
      firstRow: data?.[0] || null
    });

    if (error) {
      console.error('❌ Error fetching usage stats:', error);
      return { error: error.message };
    }

    // Aggregate the data
    const stats = {
      totalRequests: data.length,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      totalCost: 0,
      byModel: {},
      byDay: {},
      byDayByModel: {} // New: time series data grouped by both day and model
    };

    data.forEach(record => {
      stats.totalTokens += record.total_tokens || 0;
      stats.promptTokens += record.prompt_tokens || 0;
      stats.completionTokens += record.completion_tokens || 0;
      stats.reasoningTokens += record.reasoning_tokens || 0;
      stats.totalCost += parseFloat(record.estimated_cost || 0);

      // Group by model
      if (!stats.byModel[record.model_id]) {
        stats.byModel[record.model_id] = {
          requests: 0,
          tokens: 0,
          cost: 0
        };
      }
      stats.byModel[record.model_id].requests++;
      stats.byModel[record.model_id].tokens += record.total_tokens || 0;
      stats.byModel[record.model_id].cost += parseFloat(record.estimated_cost || 0);

      // Group by time period based on groupBy parameter
      let dateKey;
      const recordDate = new Date(record.created_at);
      
      switch (groupBy) {
        case 'second':
          // Group by second: YYYY-MM-DDTHH:MM:SS
          dateKey = recordDate.toISOString().slice(0, 19);
          break;
        case 'minute':
          // Group by minute: YYYY-MM-DDTHH:MM
          dateKey = recordDate.toISOString().slice(0, 16);
          break;
        case 'hour':
          // Group by hour: YYYY-MM-DDTHH
          dateKey = recordDate.toISOString().slice(0, 13);
          break;
        case 'week':
          // Group by week: get Monday of the week
          const weekStart = new Date(recordDate);
          weekStart.setDate(recordDate.getDate() - recordDate.getDay() + 1);
          dateKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          // Group by month: YYYY-MM
          dateKey = recordDate.toISOString().slice(0, 7);
          break;
        case 'day':
        default:
          // Group by day: YYYY-MM-DD
          dateKey = recordDate.toISOString().split('T')[0];
          break;
      }
      
      // Aggregate by day (all models combined)
      if (!stats.byDay[dateKey]) {
        stats.byDay[dateKey] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          cost: 0
        };
      }
      stats.byDay[dateKey].requests++;
      stats.byDay[dateKey].promptTokens += record.prompt_tokens || 0;
      stats.byDay[dateKey].completionTokens += record.completion_tokens || 0;
      stats.byDay[dateKey].reasoningTokens += record.reasoning_tokens || 0;
      stats.byDay[dateKey].totalTokens += record.total_tokens || 0;
      stats.byDay[dateKey].cost += parseFloat(record.estimated_cost || 0);

      // NEW: Aggregate by day AND model for multi-model chart
      if (!stats.byDayByModel[dateKey]) {
        stats.byDayByModel[dateKey] = {};
      }
      if (!stats.byDayByModel[dateKey][record.model_id]) {
        stats.byDayByModel[dateKey][record.model_id] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          cost: 0
        };
      }
      stats.byDayByModel[dateKey][record.model_id].requests++;
      stats.byDayByModel[dateKey][record.model_id].promptTokens += record.prompt_tokens || 0;
      stats.byDayByModel[dateKey][record.model_id].completionTokens += record.completion_tokens || 0;
      stats.byDayByModel[dateKey][record.model_id].reasoningTokens += record.reasoning_tokens || 0;
      stats.byDayByModel[dateKey][record.model_id].totalTokens += record.total_tokens || 0;
      stats.byDayByModel[dateKey][record.model_id].cost += parseFloat(record.estimated_cost || 0);
    });

    return { data: stats };
  } catch (error) {
    console.error('❌ Error in getUsageStats:', error);
    return { error: error.message };
  }
}

/**
 * Calculate estimated cost based on token usage and pricing
 * @param {number} promptTokens - Number of prompt tokens
 * @param {number} completionTokens - Number of completion tokens
 * @param {object} pricing - Pricing object with prompt and completion costs per token
 * @param {number} reasoningTokens - Number of reasoning tokens (optional)
 */
function calculateCost(promptTokens, completionTokens, pricing, reasoningTokens = 0) {
  if (!pricing || !pricing.prompt || !pricing.completion) {
    return 0;
  }

  const promptCost = (promptTokens / 1000000) * parseFloat(pricing.prompt);
  const completionCost = (completionTokens / 1000000) * parseFloat(pricing.completion);
  
  return promptCost + completionCost;
}

module.exports = {
  trackUsage,
  getUserUsage,
  getUsageStats,
  calculateCost
};
