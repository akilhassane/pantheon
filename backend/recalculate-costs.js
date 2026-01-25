/**
 * Script to recalculate costs for existing usage records
 * Run this after updating pricing information
 */

const { getSupabaseAdmin } = require('./config/supabase-client');
const { calculateCost } = require('./usage-tracking');

const supabase = getSupabaseAdmin();

/**
 * Get pricing for any model
 */
function getModelPricing(modelId, provider) {
  // OpenAI pricing (per 1M tokens)
  if (provider === 'openai' || modelId.includes('gpt-') || modelId.includes('o1-')) {
    const cleanId = modelId.replace('openai/', '').toLowerCase();
    const openaiPricing = {
      'gpt-4o': { prompt: '2.50', completion: '10.00' },
      'gpt-4o-mini': { prompt: '0.150', completion: '0.600' },
      'gpt-4o-2024-11-20': { prompt: '2.50', completion: '10.00' },
      'gpt-4o-2024-08-06': { prompt: '2.50', completion: '10.00' },
      'gpt-4o-2024-05-13': { prompt: '5.00', completion: '15.00' },
      'gpt-4-turbo': { prompt: '10.00', completion: '30.00' },
      'gpt-4-turbo-2024-04-09': { prompt: '10.00', completion: '30.00' },
      'gpt-4': { prompt: '30.00', completion: '60.00' },
      'gpt-4-32k': { prompt: '60.00', completion: '120.00' },
      'gpt-3.5-turbo': { prompt: '0.50', completion: '1.50' },
      'gpt-3.5-turbo-0125': { prompt: '0.50', completion: '1.50' },
      'gpt-3.5-turbo-1106': { prompt: '1.00', completion: '2.00' },
      'gpt-3.5-turbo-16k': { prompt: '3.00', completion: '4.00' },
      'o1-preview': { prompt: '15.00', completion: '60.00' },
      'o1-preview-2024-09-12': { prompt: '15.00', completion: '60.00' },
      'o1-mini': { prompt: '3.00', completion: '12.00' },
      'o1-mini-2024-09-12': { prompt: '3.00', completion: '12.00' },
      'o1': { prompt: '15.00', completion: '60.00' },
      'chatgpt-4o-latest': { prompt: '5.00', completion: '15.00' },
    };
    return openaiPricing[cleanId] || null;
  }
  
  // Anthropic pricing (per 1M tokens)
  if (provider === 'anthropic' || modelId.includes('claude-')) {
    const cleanId = modelId.replace('anthropic/', '').toLowerCase();
    const anthropicPricing = {
      'claude-3-5-sonnet-20241022': { prompt: '3.00', completion: '15.00' },
      'claude-3-5-sonnet-20240620': { prompt: '3.00', completion: '15.00' },
      'claude-3-5-haiku-20241022': { prompt: '1.00', completion: '5.00' },
      'claude-3-opus-20240229': { prompt: '15.00', completion: '75.00' },
      'claude-3-sonnet-20240229': { prompt: '3.00', completion: '15.00' },
      'claude-3-haiku-20240307': { prompt: '0.25', completion: '1.25' },
    };
    return anthropicPricing[cleanId] || null;
  }
  
  // Gemini pricing (per 1M tokens)
  if (provider === 'gemini' || modelId.includes('gemini')) {
    const cleanId = modelId.replace('google/', '').toLowerCase();
    const geminiPricing = {
      'gemini-2.0-flash-exp': { prompt: '0.00', completion: '0.00' }, // Free
      'gemini-1.5-pro': { prompt: '1.25', completion: '5.00' },
      'gemini-1.5-flash': { prompt: '0.075', completion: '0.30' },
      'gemini-1.5-flash-8b': { prompt: '0.0375', completion: '0.15' },
      'gemini-pro': { prompt: '0.50', completion: '1.50' },
    };
    return geminiPricing[cleanId] || null;
  }
  
  return null;
}

/**
 * Recalculate costs for all usage records
 */
async function recalculateCosts() {
  try {
    console.log('🔄 Fetching all usage records...');
    
    const { data: records, error } = await supabase
      .from('model_usage')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching records:', error);
      return;
    }
    
    console.log(`📊 Found ${records.length} usage records`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const record of records) {
      const pricing = getModelPricing(record.model_id, record.provider);
      
      if (!pricing) {
        console.log(`⚠️  No pricing for ${record.model_id} (${record.provider})`);
        skipped++;
        continue;
      }
      
      const newCost = calculateCost(
        record.prompt_tokens || 0,
        record.completion_tokens || 0,
        pricing,
        record.reasoning_tokens || 0
      );
      
      // Only update if cost changed
      if (Math.abs(newCost - parseFloat(record.estimated_cost || 0)) > 0.000001) {
        const { error: updateError } = await supabase
          .from('model_usage')
          .update({ estimated_cost: newCost })
          .eq('id', record.id);
        
        if (updateError) {
          console.error(`❌ Error updating record ${record.id}:`, updateError);
        } else {
          console.log(`✅ Updated ${record.model_id}: $${record.estimated_cost} → $${newCost.toFixed(6)}`);
          updated++;
        }
      }
    }
    
    console.log(`\n✅ Recalculation complete:`);
    console.log(`   - Updated: ${updated} records`);
    console.log(`   - Skipped: ${skipped} records (no pricing)`);
    console.log(`   - Total: ${records.length} records`);
    
  } catch (error) {
    console.error('❌ Error recalculating costs:', error);
  }
}

// Run if called directly
if (require.main === module) {
  recalculateCosts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { recalculateCosts, getModelPricing };
