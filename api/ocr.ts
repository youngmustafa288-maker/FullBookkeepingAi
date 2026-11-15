import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runDocumentOcr } from '../server/ocr'

/**
 * OCR API Route
 * Uses Gemini when GEMINI_API_KEY is configured, otherwise LM Studio.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string }

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' })
  }

  try {
    const result = await runDocumentOcr(imageBase64, mimeType || 'image/jpeg')
    const extractedText = result.text

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
      model: result.model,
      usage: result.usage
    })

  } catch (error) {
    console.error('OCR error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'OCR processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
