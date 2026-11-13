import { supabase } from './supabase'

const API_BASE = '/api'

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/**
 * Send an image to the OCR endpoint (LM Studio)
 */
export async function runOCR(imageBase64: string, mimeType: string) {
  const res = await fetch(`${API_BASE}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader())
    },
    body: JSON.stringify({ imageBase64, mimeType })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'OCR failed' }))
    throw new Error(err.error || 'OCR failed')
  }

  return res.json()
}

/**
 * Send OCR data through the model router for processing
 */
export async function processDocument(params: {
  task: string
  ocrData: unknown
  clientContext: {
    profile: string
    vendors: string
    glCodes: string
    policies: string
  }
  commonRules: string
}) {
  const res = await fetch(`${API_BASE}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader())
    },
    body: JSON.stringify(params)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Processing failed' }))
    throw new Error(err.error || 'Processing failed')
  }

  return res.json()
}

/**
 * Convert a File to base64 for OCR upload
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:...;base64, prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
