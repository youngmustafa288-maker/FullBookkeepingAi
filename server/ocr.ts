const OCR_PROMPT = `Extract all visible text and structured accounting data from this document.
Return JSON containing the vendor or merchant, date, reference number, line items, subtotal, tax, total, currency, and payment method when visible.
Use null for unreadable or missing values. Do not invent information.`

type OcrResult = {
  text: string
  model: string
  usage?: unknown
}

async function runGemini(imageBase64: string, mimeType: string, apiKey: string): Promise<OcrResult> {
  const model = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: OCR_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      }),
    })
    if (!response.ok) {
      const details = await response.text()
      console.error('Gemini OCR error:', response.status, details)
      throw new Error(`Gemini OCR rejected the request (${response.status}). Check the API key, model access, and Vercel environment scope.`)
    }
    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: unknown
    }
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || ''
    if (!text) throw new Error('Gemini OCR returned an empty response.')
    return { text, model, usage: data.usageMetadata }
  } finally {
    clearTimeout(timeout)
  }
}

async function runLmStudio(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const endpoint = process.env.LM_STUDIO_URL?.replace(/\/$/, '')
  if (!endpoint) throw new Error('OCR is not configured. Add GEMINI_API_KEY or LM_STUDIO_URL in Vercel.')
  const model = process.env.LM_STUDIO_OCR_MODEL || 'llava-llama-3'
  const base = endpoint.endsWith('/v1') ? endpoint : `${endpoint}/v1`
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: OCR_PROMPT },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: 'Extract this document as structured JSON.' },
        ] },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  })
  if (!response.ok) {
    const details = await response.text()
    console.error('LM Studio OCR error:', response.status, details)
    throw new Error(`LM Studio OCR rejected the request (${response.status}).`)
  }
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: unknown
  }
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  if (!text) throw new Error('LM Studio OCR returned an empty response.')
  return { text, model, usage: data.usage }
}

export async function runDocumentOcr(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const supportedImage = /^image\/(jpeg|png|webp)$/i.test(mimeType)
  const supportedPdf = mimeType === 'application/pdf'
  if (!supportedImage && !supportedPdf) throw new Error('OCR accepts PDF, JPEG, PNG, or WebP documents.')
  if (process.env.GEMINI_API_KEY) {
    return runGemini(imageBase64, mimeType, process.env.GEMINI_API_KEY)
  }
  if (supportedPdf) throw new Error('PDF OCR requires GEMINI_API_KEY in this deployment.')
  return runLmStudio(imageBase64, mimeType)
}
