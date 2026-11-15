// Static security/regression checks only — NOT a substitute for live Supabase RLS tests.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname, '..')
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611140004_issue_reporting.sql'), 'utf8')
const ui = fs.readFileSync(path.join(root, 'src/pages/IssueReporting.tsx'), 'utf8')
const parent = fs.readFileSync(path.join(root, 'src/pages/AutomationLayer.tsx'), 'utf8')

test('v4 declares RLS for both ticket tables with separate restricted reads', () => {
  for (const table of ['issue_reports','issue_report_events']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql, new RegExp(`grant select on public\\.issue_reports, public\\.issue_report_events to authenticated`))
  }
  assert.match(sql, /reported_by=auth\.uid\(\) or public\.is_issue_admin\(company_id\)/)
  assert.match(sql, /public\.has_company_access\(p_company_id\)/)
  assert.match(sql, /u\.role='admin'/)
  assert.doesNotMatch(sql, /create policy\s+\S+\s+on public\.issue_reports for (insert|update|delete)/i)
})

test('submission links only company-owned documents and never approves or posts', () => {
  assert.match(sql, /e\.id=p_document_id and e\.company_id=p_company_id/)
  assert.match(sql, /feedback_submitted/)
  assert.match(sql, /char_length\(v_description\) not between 10 and 3000/)
  assert.match(sql, /Too many reports in the last hour/)
  assert.doesNotMatch(sql, /public\.(vendor_rules|review_feedback|extracted_documents)\s+set\s+/i)
})

test('status changes require admin access, a note, and a recorded history event', () => {
  assert.match(sql, /if not public\.is_issue_admin\(p_company_id\)/)
  assert.match(sql, /char_length\(v_note\) not between 8 and 1000/)
  assert.match(sql, /'status_changed',v_report\.status,p_status,v_note/)
  assert.match(sql, /'feedback_status_changed'/)
  assert.match(sql, /if p_status='closed' and v_report\.status not in \('resolved','closed'\)/)
})

test('UI exposes sidebar and transaction report links and a real Supabase RPC', () => {
  assert.match(parent, /<IssueReporting /)
  assert.match(parent, /Report an issue/)
  assert.match(parent, /Report issue/)
  assert.match(ui, /supabase\.rpc\('submit_issue_report'/)
  assert.match(ui, /supabase\.rpc\('update_issue_report'/)
})
