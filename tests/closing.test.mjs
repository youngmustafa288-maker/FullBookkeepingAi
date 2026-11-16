import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newState,applyAction} from '../src/bookkeeping/engine.mjs'
import {monthEnd,monthAfter,closingReadiness} from '../src/bookkeeping/closing.mjs'

let nextId=0
const chart=`| Code | Name | Type | Active |\n|---|---|---|---|\n| 1000 | Main bank | Asset | yes |\n| 1100 | Accounts receivable | Asset | yes |\n| 2000 | Accounts payable | Liability | yes |\n| 3000 | Capital | Equity | yes |\n| 4000 | Sales | Revenue | yes |`
function book(clock='2026-12-15T10:00:00Z'){let state=newState();const act=(type,payload={},id)=>{state=applyAction(state,{id:id||`close-${++nextId}`,type,payload},'Senior reviewer',clock);return state};const approvedDoc=(kind,reference,amount,date,extra={})=>{const id=`doc-${++nextId}`;act('document',{kind,reference,party:'Buyer A',date,amount,currency:'MYR',bankAccount:'BANK-1',evidence:`Original ${reference}`,...extra},id);act('approve',{documentId:id});return id};const journal=(source,reference,date,lines)=>act('journal',{kind:'document',sourceDocumentId:source,reference,date,currency:'MYR',evidence:'Original source reviewed',lines});return {act,approvedDoc,journal,get s(){return state}}}
const closePayload=(date='2026-10-31')=>({date,currency:'MYR',reason:'Signed Oct 2026 control workpaper',controlsReviewed:true,adjustmentsReviewed:true})
function fullBook(clock){
 const b=book(clock);b.act('context',{slot:'glCodes',content:chart});
 b.act('journal',{kind:'opening',date:'2026-09-30',reference:'OPEN-SEP',currency:'MYR',evidence:'Signed prior close',lines:[{code:'1000',debit:'1000'},{code:'3000',credit:'1000'}]});
 b.act('control-map',{role:'customer',code:'1100'});b.act('control-map',{role:'bank',account:'BANK-1',code:'1000'});
 const invoice=b.approvedDoc('sales-invoice','OCT-SI','120.00','2026-10-10')
 b.journal(invoice,'J-OCT-SI','2026-10-10',[{code:'1100',debit:'120.00'},{code:'4000',credit:'120.00'}]);
 const payment=b.approvedDoc('customer-receipt','OCT-PAY','120.00','2026-10-11')
 b.journal(payment,'J-OCT-PAY','2026-10-11',[{code:'1000',debit:'120.00'},{code:'1100',credit:'120.00'}]);
 b.act('allocate',{invoiceId:invoice,paymentId:payment,amount:'120.00',date:'2026-10-11'});
 b.act('bank-import',{account:'BANK-1',currency:'MYR',opening:100000,closing:112000,rows:[{sourceId:'BANK-ROW',date:'2026-10-11',amount:12000,reference:'OCT-PAY'}]});
 b.act('bank-match',{bankId:b.s.bankRows[0].id,documentId:payment,date:'2026-10-12'});
 return b
}

test('month ends and next month are calendar-correct including February and year boundaries',()=>{
 assert.equal(monthEnd('2024-02'),'2024-02-29');assert.equal(monthEnd('2026-02'),'2026-02-28');assert.equal(monthAfter('2026-12-31'),'2027-01');
 assert.throws(()=>monthEnd('2026-13'),/valid/);assert.throws(()=>closingReadiness(newState(),'2026-10-30'),/last calendar day/)
})
test('fully reviewed October books close, lock postings, retain close evidence and audit history',()=>{
 const b=fullBook(),pack=closingReadiness(b.s,'2026-10-31','MYR','2026-12-15');assert.equal(pack.ready,true,JSON.stringify(pack.blocking));
 assert.ok(pack.checks.some(c=>c.id==='customer-MYR'&&c.status==='pass'));
 assert.ok(pack.checks.some(c=>c.id==='bank-MYR-BANK-1'&&c.status==='pass'));
 assert.throws(()=>b.act('close',{...closePayload(),adjustmentsReviewed:false}),/Confirm manual review/)
 b.act('close',closePayload(),'CLOSE-1');assert.equal(b.s.closedThrough,'2026-10-31');assert.equal(b.s.periodCloses[0].closedBy,'Senior reviewer');assert.ok(b.s.audit.some(a=>a.type==='close'))
 const snapshot=b.s
 assert.throws(()=>b.approvedDoc('sales-invoice','BACKDATED','10','2026-10-22'),/closed/)
 assert.throws(()=>b.act('journal',{kind:'opening',reference:'OLD',date:'2026-10-15',currency:'USD',evidence:'Old',lines:[]}),/closed/)
 assert.throws(()=>b.act('control-map',{role:'supplier',code:'2000'}),/Reopen/)
 assert.throws(()=>b.act('context',{slot:'glCodes',content:chart}),/Reopen/)
 assert.equal(b.s,snapshot,'failed writes are atomic')
 assert.throws(()=>b.act('reopen',{}),/reason/)
 b.act('reopen',{reason:'Approve adjustment to October cash receipt'},'OPEN-1');assert.equal(b.s.closedThrough,null)
 assert.equal(b.s.periodCloses[0].reopenReason,'Approve adjustment to October cash receipt')
 assert.ok(b.s.audit.some(a=>a.type==='reopen'))
 b.act('close',closePayload(),'CLOSE-2');assert.equal(b.s.periodCloses.length,2);assert.equal(b.s.closedThrough,'2026-10-31')
})
test('November close cannot skip a month and reopening restores the previous lock',()=>{
 const b=fullBook('2027-01-15T10:00:00Z');b.act('close',closePayload())
 assert.throws(()=>b.act('close',closePayload('2026-12-31')),/Closing sequence/)
 b.act('close',{...closePayload('2026-11-30'),reason:'November review'});assert.equal(b.s.closedThrough,'2026-11-30')
 b.act('reopen',{reason:'Repair November transaction'});assert.equal(b.s.closedThrough,'2026-10-31')
 assert.throws(()=>b.approvedDoc('sales-invoice','OLD-OCT','1.00','2026-10-15'),/closed/)
 const nov=b.approvedDoc('sales-invoice','NEW-NOV','20.00','2026-11-15')
 assert.ok(nov)
})
test('missing source journal, missing bank match, and wrong GL control each block close',()=>{
 const b=fullBook();b.approvedDoc('sales-invoice','MISSING-JOURNAL','15.00','2026-10-15')
 let pack=closingReadiness(b.s,'2026-10-31');assert.ok(pack.blocking.some(c=>c.id==='sources-MYR'))
 assert.throws(()=>b.act('close',closePayload()),/Month-end close blocked/)
 const d=b.s.documents.find(d=>d.reference==='MISSING-JOURNAL')
 b.journal(d.id,'J-MISSING','2026-10-15',[{code:'1100',debit:'15'},{code:'4000',credit:'15'}]);
 pack=closingReadiness(b.s,'2026-10-31');assert.equal(pack.ready,true)
 assert.throws(()=>b.act('control-map',{role:'customer',code:'1000'}),/distinct/) // bank GL already mapped
})
test('unmatched cash and bank rows are never silently counted as reconciled',()=>{
 const b=fullBook();b.approvedDoc('customer-receipt','EXTRA-RECEIPT','20','2026-10-20')
 let pack=closingReadiness(b.s,'2026-10-31');assert.ok(pack.blocking.some(c=>c.id==='cash-MYR'))
 assert.throws(()=>b.act('close',closePayload()),/Month-end close blocked/)
})
test('a separate recorded currency is not omitted from company close',()=>{
 const b=fullBook();b.act('document',{kind:'sales-invoice',reference:'USD-1',party:'Buyer B',date:'2026-10-14',currency:'USD',amount:'100',evidence:'Dollar invoice'},'usd1');b.act('approve',{documentId:'usd1'});
 const pack=closingReadiness(b.s,'2026-10-31');assert.deepEqual(pack.currencies,['MYR','USD']);assert.ok(pack.blocking.some(c=>c.id==='opening-USD'));assert.ok(pack.blocking.some(c=>c.id==='sources-USD'))
 assert.throws(()=>b.act('close',closePayload()),/Month-end close blocked/)
})
test('closing cannot be future-dated or dated mid-month',()=>{
 const b=fullBook();assert.throws(()=>b.act('close',closePayload('2026-11-29')),/last calendar day/)
 assert.throws(()=>b.act('close',closePayload('2027-01-31')),/future month/)
})
