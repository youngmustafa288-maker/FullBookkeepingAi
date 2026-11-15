import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export interface RequestContext {
  db: SupabaseClient
  userId: string
}

/** Authenticate the bearer token SERVER SIDE and use that identity for all RLS queries. */
export async function requireUser(req: VercelRequest): Promise<RequestContext> {
  const token = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ''))?.[1]
  if (!token) throw new ApiError(401, 'Sign in to continue.')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new ApiError(503, 'Supabase server configuration is missing.')
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new ApiError(401, 'Session expired. Please sign in again.')
  return { db, userId: data.user.id }
}

export async function requireCompany(ctx: RequestContext, companyId: string) {
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(companyId)) {
    throw new ApiError(400, 'A valid company ID is required.')
  }
  const { data, error } = await ctx.db.from('companies')
    .select('id,name,currency,tax_regime').eq('id', companyId).maybeSingle()
  if (error || !data) throw new ApiError(403, 'You do not have access to this company.')
  return data as { id: string; name: string; currency: string; tax_regime: string }
}

export function sendError(res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  const status = error instanceof ApiError ? error.status : 500
  const message = error instanceof ApiError ? error.message : 'The request could not be completed. No posting occurred.'
  if (!(error instanceof ApiError)) console.error('Automation API error', error)
  return res.status(status).json({ error: message })
}
