import Groq from 'groq-sdk';

// Initialize Groq client with API key from environment
if (!process.env.GROQ_API_KEY) {
  console.warn('WARNING: GROQ_API_KEY not set. AI-powered column detection will fall back to rule-based.');
}

const groq = process.env.GROQ_API_KEY ? new Groq({
  apiKey: process.env.GROQ_API_KEY
}) : null;

/**
 * AI-powered column detection using Groq LLM
 * Analyzes headers and sample data to intelligently map columns
 */
export async function detectColumnsWithAI(headers, sampleData) {
  if (!groq) {
    throw new Error('Groq API key not configured');
  }
  
  try {
    const prompt = `You are an expert data analyst. Analyze these Excel column headers and sample data to detect the column types for a Party Ledger import.

HEADERS: ${JSON.stringify(headers)}

SAMPLE DATA (first 5 rows):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

Map each column to one of these types:
- party_name: Customer/consigner/trader name
- date: Transaction date
- debit: Payment received (money coming in)
- credit: Freight/bill amount due (money going out)
- amount: Generic amount (if no separate debit/credit)
- description: Transaction description/narration
- reference: Reference number, cheque number, UTR
- trip_id: Trip number, LR number, bilty number
- type: Transaction type indicator (dr/cr)
- ignore: Column should be ignored

Return ONLY a valid JSON object mapping column numbers to types. Example:
{"1": "party_name", "2": "date", "3": "debit", "4": "credit", "5": "description"}

Be accurate. If a column clearly contains names, mark it party_name. If it has dates, mark it date. Numbers in "Jama/जमा" columns are debit. Numbers in "Baki/बाकी/Due" columns are credit.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const mapping = JSON.parse(response);
      // Convert to our format (type -> column number)
      const result = {};
      for (const [col, type] of Object.entries(mapping)) {
        if (type !== 'ignore') {
          result[type] = parseInt(col);
        }
      }
      return { success: true, mapping: result, raw: mapping };
    }
    return { success: false, error: 'No response from AI' };
  } catch (error) {
    console.error('Groq AI column detection error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * AI-powered transaction classification
 * Determines if a transaction is debit or credit based on description
 */
export async function classifyTransactionWithAI(description, amount) {
  if (!groq) {
    return null; // Fall back to rule-based
  }
  
  try {
    const prompt = `Classify this ledger transaction as either "debit" (payment received) or "credit" (freight/bill due).

Description: "${description}"
Amount: ${amount}

Context:
- "debit" = Payment received, cash/bank receipt, collection, jama (जमा)
- "credit" = Freight charges, bill amount, outstanding due, baki (बाकी)

Return ONLY a JSON: {"type": "debit"} or {"type": "credit"}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 50,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const result = JSON.parse(response);
      return result.type || 'credit';
    }
    return 'credit'; // Default to credit
  } catch (error) {
    console.error('Groq AI classification error:', error.message);
    return null; // Return null to fall back to rule-based
  }
}

/**
 * AI-powered party name matching
 * Finds best match from existing parties
 */
export async function matchPartyWithAI(inputName, existingParties) {
  if (!groq) {
    return null; // Fall back to rule-based
  }
  
  if (!existingParties || existingParties.length === 0) {
    return null;
  }

  try {
    const partyList = existingParties.slice(0, 50).map(p => p.name).join('\n');
    
    const prompt = `Find the best matching party name from the existing list.

INPUT NAME: "${inputName}"

EXISTING PARTIES:
${partyList}

If there's a good match (same company, similar spelling, abbreviation), return the exact matching name.
If no good match exists, return "NEW".

Return ONLY a JSON: {"match": "Exact Party Name"} or {"match": "NEW"}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (response) {
      const result = JSON.parse(response);
      if (result.match && result.match !== 'NEW') {
        const matchedParty = existingParties.find(p => 
          p.name.toLowerCase() === result.match.toLowerCase()
        );
        if (matchedParty) {
          return { party: matchedParty, confidence: 'ai-matched' };
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Groq AI party matching error:', error.message);
    return null;
  }
}

/**
 * AI-powered bulk analysis of imported data
 * Analyzes all rows and provides intelligent suggestions
 */
export async function analyzeImportDataWithAI(headers, allRows, existingParties) {
  try {
    // First, detect columns
    const columnDetection = await detectColumnsWithAI(headers, allRows);
    
    if (!columnDetection.success) {
      return { success: false, error: columnDetection.error };
    }

    return {
      success: true,
      columnMapping: columnDetection.mapping,
      aiDetected: true,
      model: 'llama-3.3-70b-versatile'
    };
  } catch (error) {
    console.error('Groq AI analysis error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Extract and parse data intelligently using AI
 */
export async function parseRowWithAI(rowData, columnMapping) {
  // For individual row parsing, we'll use rule-based for speed
  // AI is used mainly for initial column detection
  return null;
}

export default {
  detectColumnsWithAI,
  classifyTransactionWithAI,
  matchPartyWithAI,
  analyzeImportDataWithAI
};
