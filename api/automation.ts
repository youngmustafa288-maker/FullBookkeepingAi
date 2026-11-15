import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ApiError, requireUser, requireCompany, sendError } from '../server/auth'
import { extractImage, proposeFields, validateFields, verifyImage, workflowReferenceFingerprint, type Context } from '../server/engine'
import { buildDecisionExplanation } from '../server/explanation'

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new ApiError(503, 'Server storage credentials are not configured.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' })
  try {
    const user = await requireUser(req)
    const companyId = String(req.method === 'GET' ? req.query.companyId || '' : req.body?.companyId || '')
    const company = await requireCompany(user, companyId)

    if (req.method === 'GET') {
      const { data, error } = await user.db.from('extracted_documents')
        .select('id,job_id,company_id,document_type,source_filename,source_storage_path,source_mime_type,extracted_fields,confidence_scores,agent_notes,decision_explanation,processing_context,status,final_fields,created_at,approved_at')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(200)
      if (error) throw new ApiError(502, 'Could not load the company review queue.')
      return res.status(200).json({ documents: data || [] })
    }

    if (req.body?.action === 'review') {
      const documentId = String(req.body.documentId || '')
      const decision = String(req.body.decision || '')
      if (!/^[0-9a-f-]{36}$/i.test(documentId) || !['approve', 'reject'].includes(decision)) throw new ApiError(400, 'Invalid review request.')
      const { data, error } = await user.db.rpc('resolve_accounting_proposal', {
        p_company_id: companyId,
        p_document_id: documentId,
        p_decision: decision,
        p_final_fields: decision === 'approve' ? req.body.fields : null,
        p_note: String(req.body.note || '').slice(0, 1000),
      })
      if (error) throw new ApiError(422, error.message)
      return res.status(200).json({ document: data, posted: false })
    }

    if (req.body?.action !== 'process') throw new ApiError(400, 'Unknown action.')
    const workflow = req.body.workflow
    if (workflow !== 'receipt' && workflow !== 'invoice') throw new ApiError(400, 'This version supports receipts and purchase invoices only.')
    const storagePath = String(req.body.storagePath || '')
    const filename = String(req.body.filename || '').replace(/[\/\\\x00-\x1f]/g, '').slice(0, 200)
    const mimeType = req.body.mimeType
    if (!filename || !new RegExp(`^${companyId}/[a-f0-9-]{36}\\.(jpg|jpeg|png)$`, 'i').test(storagePath)) throw new ApiError(400, 'Invalid private source-file path.')
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') throw new ApiError(415, 'Only PNG and JPEG images are supported in this release.')
    // This download respects both the private bucket policy and the user's company membership.
    const { data: file, error: storageError } = await user.db.storage.from('accounting-sources').download(storagePath)
    if (storageError || !file) throw new ApiError(403, 'Source file was not found or is not accessible.')
    if (file.size > 8 * 1024 * 1024) throw new ApiError(413, 'Document exceeds the 8 MB upload limit.')
    const bytes = Buffer.from(await file.arrayBuffer())
    verifyImage(bytes, mimeType)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const idempotency = createHash('sha256').update(`${companyId}:${workflow}:${hash}`).digest('hex')
    const service = admin()
    const { data: existing } = await service.from('agent_jobs').select('id,status,retry_count').eq('idempotency_key', idempotency).maybeSingle()
    if (existing && (existing.status !== 'failed' || existing.retry_count >= 3)) {
      throw new ApiError(409, `This document was already submitted (status: ${existing.status}). Check the review queue.`)
    }

    const [{ data: glCodes, error: glError }, { data: vendorRules, error: vendorError }, { data: policies, error: policyError }] = await Promise.all([
      user.db.from('gl_codes').select('code,name,account_type').eq('company_id', companyId).eq('active', true),
      user.db.from('vendor_rules').select('vendor_pattern,gl_code,default_category,tax_code').eq('company_id', companyId).eq('status', 'approved'),
      user.db.from('client_policies').select('policy_key,policy_value').eq('company_id', companyId).eq('active', true),
    ])
    if (glError || vendorError || policyError) throw new ApiError(502, 'Unable to retrieve approved client-specific accounting context.')
    const context: Context = { company, glCodes: glCodes || [], vendorRules: vendorRules || [], policies: policies || [] }

    const input = { filename, mimeType, storagePath, sha256: hash }
    // Failed attempts can be reclaimed at most 3 times. Conditional status prevents concurrent retry claims.
    const claimed = existing
      ? await service.from('agent_jobs').update({
          status: 'processing', retry_count: existing.retry_count + 1,
          user_id: user.userId, input_payload: input, error_message: null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id).eq('status', 'failed').select('id').maybeSingle()
      : await service.from('agent_jobs').insert({
          company_id: companyId, user_id: user.userId, workflow,
          status: 'processing', idempotency_key: idempotency, input_payload: input,
        }).select('id').single()
    const { data: job, error: jobError } = claimed
    if (existing && job) {
      const { error: retryAuditError } = await service.from('audit_log').insert({
        actor_type: 'human', actor_id: user.userId, workflow,
        action: 'retried', company_id: companyId, document_ref: filename,
        job_id: job.id, note: `Reprocessed after failed AI attempt (retry ${existing.retry_count + 1}/3).`,
      })
      if (retryAuditError) {
        await service.from('agent_jobs').update({ status: 'failed', error_message: 'Retry audit write failed', updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'processing')
        throw new ApiError(502, 'Could not append retry audit event; processing stopped.')
      }
    }
    if (jobError || !job) {
      if (jobError?.code === '23505' || (existing && !job)) throw new ApiError(409, 'This document is already being processed. Check the review queue.')
      throw new ApiError(502, 'Unable to stage the processing job.')
    }

    try {
      const ocr = await extractImage(bytes, mimeType)
      const proposal = await proposeFields(workflow, ocr, context)
      const validation = validateFields(proposal.fields, context)
      const notes = [...new Set([...validation, ...proposal.warnings])].slice(0, 20)
      const explanation = buildDecisionExplanation(proposal.fields, context, validation, proposal.decisionExplanation)
      const contextFingerprint = createHash('sha256').update(JSON.stringify({
        glCodes: [...context.glCodes].sort((a, b) => a.code.localeCompare(b.code)),
        vendorRules: [...context.vendorRules].sort((a, b) => a.vendor_pattern.localeCompare(b.vendor_pattern)),
        policies: [...context.policies].sort((a, b) => a.policy_key.localeCompare(b.policy_key)),
      })).digest('hex')
      // One database transaction: document, submission audit event and job state.
      const { data: documentId, error: stageError } = await service.rpc('stage_accounting_document', {
        p_job_id: job.id,
        p_document_type: workflow === 'invoice' ? 'purchase_invoice' : 'receipt',
        p_filename: filename,
        p_storage_path: storagePath,
        p_mime_type: mimeType,
        p_ocr: ocr,
        p_fields: proposal.fields,
        p_confidence: { model_self_reported: proposal.confidence, deterministic_issues: validation.length,
          explanation, provenance: { source_sha256: hash, client_context_sha256: contextFingerprint,
            ai_provider: 'OpenRouter', ai_model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
            ocr_provider: 'LM Studio', ocr_model: process.env.LM_STUDIO_OCR_MODEL, workflow_version: 'v3-explain-1',
            workflow_rules_sha256: workflowReferenceFingerprint(workflow),
            recorded_at: new Date().toISOString() } },
        p_notes: notes,
      })
      if (stageError || !documentId) throw new Error('Atomic staging failed')
      return res.status(201).json({ documentId, warnings: notes, posted: false })
    } catch (error) {
      await service.from('agent_jobs').update({ status: 'failed', updated_at: new Date().toISOString(), error_message: error instanceof Error ? error.message.slice(0, 400) : 'Processing failed' }).eq('id', job.id)
      // Errors must also be traceable. Avoid exposing prompts, tokens, or raw OCR in the log.
      const { error: auditError } = await service.from('audit_log').insert({
        actor_type: 'workflow', actor_id: user.userId, workflow, action: 'failed',
        company_id: companyId, document_ref: filename, job_id: job.id,
        note: 'Document processing failed before a review draft could be saved; no accounting entry posted.',
        final_values: { stage: 'processing', failure_code: error instanceof ApiError ? error.status : 502 },
      })
      if (auditError) throw new ApiError(502, 'Processing failed and failure audit could not be recorded. Check the server event log.')
      throw error
    }
  } catch (error) { return sendError(res, error) }
}
