import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Model Router Configuration
 * 
 * Strategy: Try free/cheap models first, escalate based on task complexity and confidence.
 * 
 * Tier 1 (Free): meta-llama/llama-3.3-70b-instruct:free, google/gemma-3-27b-it:free
 * Tier 2 (Flash): deepseek/deepseek-chat (DeepSeek V3) - fast and cheap
 * Tier 3 (Pro): deepseek/deepseek-reasoner (DeepSeek R1) - complex reasoning
 */

interface ModelTier {
  id: string
  name: string
  confidenceThreshold: number // Below this, escalate to next tier
}

const MODEL_TIERS: ModelTier[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Free (Llama 3.3)', confidenceThreshold: 0.75 },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Flash', confidenceThreshold: 0.85 },
  { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Pro', confidenceThreshold: 1.0 },
]

// Task complexity affects starting tier
const TASK_STARTING_TIER: Record<string, number> = {
  'receipt': 0,              // Start with free model
  'invoice': 0,              // Start with free model
  'bank-reconciliation': 1,  // Start with DeepSeek Flash (more complex)
  'reporting': 1,            // Start with DeepSeek Flash (needs analysis)
}

interface ProcessRequest {
  task: string
  ocrData: unknown
  clientContext: {
    profile: string
    vendors: string
    glCodes: string
    policies: string
  }
  commonRules: string
}

interface ModelResponse {
  content: string
  model: string
  confidence: number
  reasoning?: string
}

async function callModel(modelId: string, prompt: string, apiKey: string): Promise<ModelResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://bookai.app',
      'X-Title': 'BookAI'
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Model ${modelId} failed: ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // Extract confidence from response (model should include it in output)
  let confidence = 0.8 // Default
  const confMatch = content.match(/"confidence"\s*:\s*(0?\.\d+|1\.0)/i)
  if (confMatch) {
    confidence = parseFloat(confMatch[1])
  }

  return {
    content,
    model: modelId,
    confidence
  }
}

function buildPrompt(task: string, ocrData: unknown, clientContext: ProcessRequest['clientContext'], commonRules: string): string {
  return `# Common Rules
${commonRules}

# Task: ${task}

## OCR Extracted Data
\`\`\`json
${JSON.stringify(ocrData, null, 2)}
\`\`\`

## Client Profile
${clientContext.profile}

## Approved Vendor Mappings
${clientContext.vendors}

## Allowed GL Codes
${clientContext.glCodes}

## Client Policies
${clientContext.policies}

---

Process this ${task} and return your analysis as JSON.

## Confidence Scoring Criteria

You MUST calculate confidence based on these specific factors:

**Start at 1.0 (100%) and DEDUCT for each issue:**

### Data Quality (-0.05 to -0.20 each)
- OCR errors or unclear text: -0.10
- Missing required fields (date, amount, vendor): -0.15 each
- Illegible or corrupted data: -0.20
- Handwritten vs printed (handwritten less reliable): -0.05

### Vendor Matching (-0.05 to -0.30)
- Exact match to approved vendor list: 0 (no deduction)
- Fuzzy match (similar name, possible typo): -0.10
- New vendor not in approved list: -0.20
- Multiple possible vendor matches: -0.15
- Vendor name completely unclear: -0.30

### GL Code Assignment (-0.05 to -0.25)
- Clear match to vendor's default GL code: 0 (no deduction)
- Category matches but GL code inferred: -0.10
- New category not in vendor mapping: -0.15
- Ambiguous category (could be multiple GL codes): -0.20
- No matching GL code in client's chart: -0.25

### Amount Validation (-0.10 to -0.30)
- Amount clearly visible and matches line items: 0 (no deduction)
- Subtotal/tax/total don't add up correctly: -0.15
- Amount partially obscured or unclear: -0.20
- Currency mismatch with client profile: -0.25
- Amount seems unreasonable for category: -0.30

### Date/Period Issues (-0.05 to -0.20)
- Date clearly visible: 0 (no deduction)
- Date format ambiguous (DD/MM vs MM/DD): -0.10
- Date outside current accounting period: -0.15
- Date completely missing or illegible: -0.20

### Tax/SST Issues (-0.05 to -0.25)
- Tax code clearly visible and matches vendor: 0 (no deduction)
- Tax amount present but rate unclear: -0.10
- Tax calculation doesn't match visible rate: -0.15
- Missing tax information when required: -0.20
- Tax-exempt claim without evidence: -0.25

### Policy Compliance (-0.10 to -0.30)
- Within approval thresholds: 0 (no deduction)
- Exceeds approval threshold but approver known: -0.05
- Exceeds approval threshold, approver unknown: -0.15
- Violates client policy (e.g., personal expense): -0.30
- Missing required documentation: -0.20

### Duplicate/Suspicious Items (-0.10 to -0.40)
- No duplicate detected: 0 (no deduction)
- Possible duplicate (same vendor, similar amount, close date): -0.15
- Likely duplicate (same vendor, same amount, same date): -0.30
- Suspicious pattern (unusual timing, round numbers): -0.20
- Clear duplicate: -0.40

## Required JSON Structure

Return your analysis in this exact format:

\`\`\`json
{
  "extracted_fields": {
    "vendor": "Vendor name",
    "date": "YYYY-MM-DD",
    "amount": 123.45,
    "tax_amount": 12.35,
    "subtotal": 111.10,
    "currency": "MYR",
    "category": "Office Supplies",
    "gl_code": "6300",
    "tax_code": "SR",
    "reference": "INV-2024-001",
    "description": "Brief description"
  },
  "confidence": 0.85,
  "confidence_breakdown": {
    "data_quality": 0.95,
    "vendor_match": 1.00,
    "gl_assignment": 0.90,
    "amount_validation": 0.85,
    "date_period": 1.00,
    "tax_compliance": 0.90,
    "policy_compliance": 1.00,
    "duplicate_check": 1.00
  },
  "warnings": [
    "Warning message if any issues detected"
  ],
  "reasoning": "Detailed explanation of your analysis, including what you checked and why you assigned this confidence score. Reference specific factors from the scoring criteria."
}
\`\`\`

## Important Notes

- Be conservative with confidence - when in doubt, score lower
- Always provide specific reasoning that references the scoring criteria
- If confidence < 0.70, you MUST include warnings
- Check for duplicates against the OCR data patterns
- Validate that amounts add up (subtotal + tax = total)
- Verify vendor exists in approved mappings
- Ensure GL code exists in client's chart of accounts
- Check tax codes match vendor's typical pattern
- Flag any policy violations clearly

Be precise with financial data. Accuracy is more important than speed.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { task, ocrData, clientContext, commonRules } = req.body as ProcessRequest

  if (!task || !ocrData || !clientContext) {
    return res.status(400).json({ error: 'Missing required fields: task, ocrData, clientContext' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
  }

  const prompt = buildPrompt(task, ocrData, clientContext, commonRules)
  const startTier = TASK_STARTING_TIER[task] ?? 0

  let currentTier = startTier
  let result: ModelResponse | null = null
  const attempts: Array<{ model: string; confidence: number; escalated: boolean }> = []

  // Try models in order, escalating if confidence is too low
  while (currentTier < MODEL_TIERS.length) {
    const tier = MODEL_TIERS[currentTier]
    
    try {
      result = await callModel(tier.id, prompt, apiKey)
      attempts.push({ model: tier.name, confidence: result.confidence, escalated: false })

      // If confidence is high enough, we're done
      if (result.confidence >= tier.confidenceThreshold) {
        break
      }

      // Otherwise, escalate to next tier
      if (currentTier < MODEL_TIERS.length - 1) {
        console.log(`Model ${tier.name} returned confidence ${result.confidence}, escalating...`)
        currentTier++
      } else {
        break // Already at highest tier
      }
    } catch (error) {
      console.error(`Error with ${tier.name}:`, error)
      attempts.push({ model: tier.name, confidence: 0, escalated: true })
      
      // Try next tier on error
      if (currentTier < MODEL_TIERS.length - 1) {
        currentTier++
      } else {
        return res.status(500).json({ 
          error: 'All model tiers failed',
          attempts 
        })
      }
    }
  }

  if (!result) {
    return res.status(500).json({ error: 'No result from any model' })
  }

  // Parse the model's JSON response
  let parsed
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      parsed = { raw: result.content }
    }
  } catch {
    parsed = { raw: result.content }
  }

  // Extract confidence breakdown if available
  const confidenceBreakdown = parsed.confidence_breakdown || null

  return res.status(200).json({
    success: true,
    task,
    result: parsed,
    model_used: result.model,
    confidence: result.confidence,
    confidence_breakdown: confidenceBreakdown,
    attempts
  })
}
