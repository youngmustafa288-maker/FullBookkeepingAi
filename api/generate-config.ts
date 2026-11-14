import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * AI-powered configuration generation
 * 
 * Two modes:
 * 1. "conversation" - Generate config from client chat (onboarding)
 * 2. "learn" - Extract mappings from approved review items
 * 
 * Output: Internal Markdown files that the workflow engine reads
 * Clients never see these files directly
 */

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateRequest {
  mode: 'conversation' | 'learn'
  configType: 'glCodes' | 'vendors' | 'policies' | 'profile'
  clientId: string
  conversation?: ConversationMessage[]
  approvedReviews?: Array<{
    vendor: string
    category: string
    glCode: string
    amount: number
    description: string
  }>
  existingConfig?: string
}

const SYSTEM_PROMPTS = {
  glCodes: `You are an accounting expert helping set up a client's chart of accounts.
Based on the conversation or approved transactions, generate a comprehensive GL code list.

Output as Markdown with this structure:
# Chart of Accounts

## Assets
- 1000: Cash and Bank
- 1100: Accounts Receivable
...

## Liabilities
- 2000: Accounts Payable
...

## Equity
- 3000: Owner's Equity
...

## Revenue
- 4000: Sales Revenue
...

## Expenses
- 5000: Cost of Goods Sold
- 6000: Operating Expenses
...

Use standard accounting numbering. Be comprehensive but relevant to the client's business.`,

  vendors: `You are an accounting expert mapping vendors to GL codes and categories.
Based on the conversation or approved transactions, generate vendor mappings.

Output as Markdown with this structure:
# Vendor Mappings

## Approved Vendors

### [Vendor Name]
- Category: [Office Supplies, Software, Services, etc.]
- Default GL Code: [code]
- Tax Code: [SST-01, Exempt, etc.]
- Notes: [Any special handling]

Group similar vendors together. Include common vendors for this type of business.`,

  policies: `You are an accounting expert defining client-specific policies.
Based on the conversation, generate approval and review policies.

Output as Markdown with this structure:
# Client Policies

## Approval Thresholds
- Transactions above RM [amount] require manager approval
- New vendors require [approval type]

## Review Requirements
- [Specific review rules for this client]

## Tax Handling
- [SST/GST rules specific to this client]

## Special Instructions
- [Any client-specific accounting rules]

Be specific and actionable.`,

  profile: `You are an accounting expert capturing client business profile.
Based on the conversation, generate a business profile.

Output as Markdown with this structure:
# Client Profile

## Business Details
- Company Name: [name]
- Industry: [industry]
- Business Type: [Sole prop, Sdn Bhd, etc.]
- Currency: [MYR, USD, etc.]

## Operations
- [Key business activities]
- [Number of locations/employees if mentioned]

## Banking
- Primary bank: [if mentioned]
- Bank adapters: [Maybank, CIMB, etc.]

## Tax Registration
- SST registered: [Yes/No]
- SST number: [if provided]

Capture all relevant business context.`
}

async function callModel(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://bookai.app',
      'X-Title': 'BookAI'
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error(`Model failed: ${await response.text()}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mode, configType, clientId, conversation, approvedReviews, existingConfig } = req.body as GenerateRequest

  if (!mode || !configType || !clientId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
  }

  try {
    let prompt = SYSTEM_PROMPTS[configType]

    if (mode === 'conversation' && conversation) {
      // Build prompt from conversation
      const history = conversation.map(m => `${m.role}: ${m.content}`).join('\n\n')
      prompt += `\n\n## Conversation with Client\n\n${history}\n\n`
      
      if (existingConfig) {
        prompt += `\n## Current Configuration (update/extend this)\n\n${existingConfig}\n\n`
      }
      
      prompt += `\nGenerate or update the ${configType} configuration based on this conversation.`
    } 
    else if (mode === 'learn' && approvedReviews) {
      // Build prompt from approved reviews
      const reviewsText = approvedReviews.map(r => 
        `- Vendor: ${r.vendor}, Category: ${r.category}, GL: ${r.glCode}, Amount: RM ${r.amount}, Description: ${r.description}`
      ).join('\n')
      
      prompt += `\n\n## Recently Approved Transactions\n\n${reviewsText}\n\n`
      
      if (existingConfig) {
        prompt += `\n## Current Configuration\n\n${existingConfig}\n\n`
        prompt += `Extract new vendor mappings and GL codes from these approved transactions and add them to the existing configuration.`
      } else {
        prompt += `Generate initial ${configType} configuration from these approved transactions.`
      }
    }

    const generated = await callModel(prompt, apiKey)

    return res.status(200).json({
      success: true,
      configType,
      markdown: generated,
      mode
    })

  } catch (error) {
    console.error('Config generation error:', error)
    return res.status(500).json({ 
      error: 'Configuration generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
