import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Document Analysis API
 * 
 * Analyzes uploaded accounting documents (CSV, Excel, PDF) and extracts:
 * - Chart of accounts / GL codes
 * - Vendor mappings
 * - Business profile
 * - Policies and rules
 * 
 * Flow:
 * 1. Client uploads previous accounting records
 * 2. OCR if PDF/image
 * 3. AI analyzes content and extracts structure
 * 4. Returns generated configs for bookkeeper review
 */

interface AnalyzeRequest {
  documentBase64: string
  mimeType: string
  fileName: string
  clientId: string
  configType?: 'glCodes' | 'vendors' | 'policies' | 'profile' | 'all'
}

const ANALYSIS_PROMPT = `You are an expert accountant analyzing a client's previous accounting records.

Extract the following information and return as JSON:

{
  "profile": {
    "businessName": "string",
    "industry": "string",
    "businessType": "Sole prop/Sdn Bhd/etc",
    "currency": "MYR/USD/etc",
    "taxRegistration": { "sst": boolean, "sstNumber": "string" },
    "banking": { "primaryBank": "string", "adapters": ["Maybank", "CIMB"] }
  },
  "glCodes": [
    { "code": "1000", "name": "Cash and Bank", "type": "Asset" },
    { "code": "2000", "name": "Accounts Payable", "type": "Liability" },
    { "code": "4000", "name": "Sales Revenue", "type": "Revenue" },
    { "code": "5000", "name": "Cost of Goods Sold", "type": "Expense" }
  ],
  "vendors": [
    { "name": "Vendor Name", "category": "Office Supplies", "glCode": "6300", "taxCode": "SST-01" }
  ],
  "policies": {
    "approvalThresholds": [
      { "amount": 5000, "requires": "Manager approval" },
      { "amount": 20000, "requires": "Director approval" }
    ],
    "reviewRequirements": ["Monthly reconciliation mandatory"],
    "taxHandling": "Standard SST rules apply"
  }
}

Analyze the document carefully:
- For chart of accounts: extract all account codes, names, and types
- For vendor lists: extract vendor names and any associated codes/categories
- For financial statements: infer business type, industry, and structure
- For bank statements: identify banking relationships

Be thorough and accurate. Use standard accounting conventions.
If information is unclear or missing, make reasonable assumptions based on the business type.`

async function callModel(prompt: string, documentContent: string, apiKey: string): Promise<string> {
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
      messages: [
        { 
          role: 'system', 
          content: ANALYSIS_PROMPT 
        },
        { 
          role: 'user', 
          content: `Analyze this accounting document and extract the configuration:\n\n${documentContent}` 
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error(`Model failed: ${await response.text()}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

function convertToMarkdown(configType: string, data: any): string {
  switch (configType) {
    case 'profile':
      return `# Client Profile

## Business Details
- Company Name: ${data.businessName || 'Unknown'}
- Industry: ${data.industry || 'Unknown'}
- Business Type: ${data.businessType || 'Unknown'}
- Currency: ${data.currency || 'MYR'}

## Tax Registration
- SST Registered: ${data.taxRegistration?.sst ? 'Yes' : 'No'}
${data.taxRegistration?.sstNumber ? `- SST Number: ${data.taxRegistration.sstNumber}` : ''}

## Banking
- Primary Bank: ${data.banking?.primaryBank || 'Not specified'}
- Bank Adapters: ${data.banking?.adapters?.join(', ') || 'None configured'}
`

    case 'glCodes':
      const grouped = {
        Asset: data.glCodes?.filter((g: any) => g.type === 'Asset') || [],
        Liability: data.glCodes?.filter((g: any) => g.type === 'Liability') || [],
        Equity: data.glCodes?.filter((g: any) => g.type === 'Equity') || [],
        Revenue: data.glCodes?.filter((g: any) => g.type === 'Revenue') || [],
        Expense: data.glCodes?.filter((g: any) => g.type === 'Expense') || []
      }
      
      return `# Chart of Accounts

## Assets
${grouped.Asset.map((g: any) => `- ${g.code}: ${g.name}`).join('\n') || '- None found'}

## Liabilities
${grouped.Liability.map((g: any) => `- ${g.code}: ${g.name}`).join('\n') || '- None found'}

## Equity
${grouped.Equity.map((g: any) => `- ${g.code}: ${g.name}`).join('\n') || '- None found'}

## Revenue
${grouped.Revenue.map((g: any) => `- ${g.code}: ${g.name}`).join('\n') || '- None found'}

## Expenses
${grouped.Expense.map((g: any) => `- ${g.code}: ${g.name}`).join('\n') || '- None found'}
`

    case 'vendors':
      return `# Vendor Mappings

## Approved Vendors

${data.vendors?.map((v: any) => `### ${v.name}
- Category: ${v.category || 'Uncategorized'}
- Default GL Code: ${v.glCode || 'Not assigned'}
- Tax Code: ${v.taxCode || 'Standard'}
`).join('\n') || 'No vendors found in document'}
`

    case 'policies':
      return `# Client Policies

## Approval Thresholds
${data.policies?.approvalThresholds?.map((t: any) => `- Above RM ${t.amount}: ${t.requires}`).join('\n') || '- No thresholds specified'}

## Review Requirements
${data.policies?.reviewRequirements?.map((r: string) => `- ${r}`).join('\n') || '- No specific requirements'}

## Tax Handling
${data.policies?.taxHandling || 'Standard tax rules apply'}
`

    default:
      return ''
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { documentBase64, mimeType, fileName, clientId, configType = 'all' } = req.body as AnalyzeRequest

  if (!documentBase64 || !mimeType || !fileName || !clientId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' })
  }

  try {
    let documentContent = ''

    // Handle different file types
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      // OCR the document first
      const ocrResponse = await fetch(`${process.env.LM_STUDIO_URL || 'http://localhost:1234'}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.LM_STUDIO_OCR_MODEL || 'llava-llama-3',
          messages: [
            {
              role: 'system',
              content: 'Extract all text from this accounting document. Preserve structure and formatting.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${documentBase64}` }
                },
                {
                  type: 'text',
                  text: 'Extract all text from this document.'
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      })

      if (ocrResponse.ok) {
        const ocrData = await ocrResponse.json()
        documentContent = ocrData.choices?.[0]?.message?.content || ''
      } else {
        throw new Error('OCR failed')
      }
    } else {
      // CSV/Excel - decode base64
      documentContent = Buffer.from(documentBase64, 'base64').toString('utf-8')
    }

    // Analyze with AI
    const analysis = await callModel(ANALYSIS_PROMPT, documentContent, apiKey)
    
    // Parse JSON response
    let parsed
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON in response')
      }
    } catch (e) {
      console.error('Failed to parse AI response:', analysis)
      throw new Error('AI returned invalid format')
    }

    // Convert to Markdown based on requested type
    const configs: Record<string, string> = {}
    
    if (configType === 'all' || configType === 'profile') {
      configs.profile = convertToMarkdown('profile', parsed)
    }
    if (configType === 'all' || configType === 'glCodes') {
      configs.glCodes = convertToMarkdown('glCodes', parsed)
    }
    if (configType === 'all' || configType === 'vendors') {
      configs.vendors = convertToMarkdown('vendors', parsed)
    }
    if (configType === 'all' || configType === 'policies') {
      configs.policies = convertToMarkdown('policies', parsed)
    }

    return res.status(200).json({
      success: true,
      fileName,
      configs,
      summary: {
        glCodesCount: parsed.glCodes?.length || 0,
        vendorsCount: parsed.vendors?.length || 0,
        hasProfile: Boolean(parsed.profile?.businessName),
        hasPolicies: Boolean(parsed.policies)
      }
    })

  } catch (error) {
    console.error('Document analysis error:', error)
    return res.status(500).json({ 
      error: 'Document analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
