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

Process this ${task} according to the rules above. Return your analysis as JSON with this structure:
{
  "extracted_fields": { ... },
  "categorization": { ... },
  "warnings": [...],
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis"
}

Be precise with financial data. If you're uncertain about any field, set confidence lower and explain in reasoning.`
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

  return res.status(200).json({
    success: true,
    task,
    result: parsed,
    model_used: result.model,
    confidence: result.confidence,
    attempts
  })
}
