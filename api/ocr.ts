import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * OCR API Route
 * Calls your local LM Studio instance (exposed via tunnel) for document OCR.
 * LM Studio uses an OpenAI-compatible chat completions API.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string }

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' })
  }

  const ocrEndpoint = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1'
  const ocrModel = process.env.LM_STUDIO_OCR_MODEL || 'llava-llama-3'

  try {
    const response = await fetch(`${ocrEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ocrModel,
        messages: [
          {
            role: 'system',
            content: `You are a document OCR assistant. Extract all text from the image accurately. 
            For financial documents (receipts, invoices, bank statements), extract structured data including:
            - Vendor/merchant name
            - Date
            - Line items with descriptions, quantities, unit prices, and totals
            - Subtotal, tax, and total amounts
            - Payment method if visible
            Return the extracted data as JSON.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: 'Extract all text and structured data from this document.'
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('LM Studio error:', errorText)
      return res.status(502).json({ error: 'OCR service unavailable', details: errorText })
    }

    const data = await response.json()
    const extractedText = data.choices?.[0]?.message?.content || ''

    // Try to parse as JSON, fall back to raw text
    let structuredData
    try {
      // Look for JSON in the response
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        structuredData = JSON.parse(jsonMatch[0])
      } else {
        structuredData = { rawText: extractedText }
      }
    } catch {
      structuredData = { rawText: extractedText }
    }

    return res.status(200).json({
      success: true,
      data: structuredData,
      model: ocrModel,
      usage: data.usage
    })

  } catch (error) {
    console.error('OCR error:', error)
    return res.status(500).json({ 
      error: 'OCR processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
