import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser, requireCompany, sendError, ApiError } from '../server/auth'
import { csvCell } from '../server/csv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const user = await requireUser(req)
    const companyId = String(req.query.companyId || '')
    await requireCompany(user, companyId)
    const { data, error } = await user.db.from('extracted_documents')
      .select('id,document_type,source_filename,approved_at,final_fields,status')
      .eq('company_id', companyId).eq('status', 'approved')
      .order('approved_at', { ascending: true }).limit(1000)
    if (error) throw new ApiError(502, 'Could not export approved documents.')
    if (!data?.length) throw new ApiError(422, 'No approved documents are available for export.')
    if (data.some(row => !row.final_fields)) throw new ApiError(422, 'An approved document is missing its final review values. Export stopped.')
    const columns = ['source_id','source_filename','document_type','vendor','reference','date','currency','amount','subtotal','tax_amount','gl_code','tax_code','category','description','approved_at']
    const lines = [columns.map(csvCell).join(',')]
    for (const row of data || []) {
      const fields = row.final_fields as Record<string, unknown> | null
      if (!fields) continue
      const values: Record<string, unknown> = { ...fields, source_id: row.id, source_filename: row.source_filename, document_type: row.document_type, approved_at: row.approved_at }
      lines.push(columns.map(col => csvCell(values[col])).join(','))
    }
    // Audit only the preparation of a response, never claim download/import/posting.
    const { data: loggedCount, error: auditError } = await user.db.rpc('record_accounting_export', {
      p_company_id: companyId, p_document_ids: data.map(row => row.id), p_format: 'csv',
    })
    if (auditError || loggedCount !== data.length) throw new ApiError(502, 'CSV was not sent because its audit event could not be recorded.')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="bookai-approved-${companyId.slice(0,8)}.csv"`)
    return res.status(200).send(`\uFEFF${lines.join('\r\n')}\r\n`)
  } catch (error) { return sendError(res, error) }
}
