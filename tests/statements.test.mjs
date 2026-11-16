import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newState,applyAction} from '../src/bookkeeping/engine.mjs'
import {profitAndLoss,balanceSheet,generalLedgerDetail,statementReadiness} from '../src/bookkeeping/statements.mjs'
import {trialBalance} from '../src/bookkeeping/ledger.mjs'
let sequence=0
const chart=`| Code | Name | Type | Active |\n|---|---|---|---|\n| 1000 | Cash at bank | Asset | Yes |\n| 1100 | Accounts receivable | Asset | Yes |\n| 1200 | Accumulated depreciation | Asset | Yes |\n| 2000 | Accounts payable | Liability | Yes |\n| 3000 | Share capital | Equity | Yes |\n| 4000 | Revenue | Revenue | Yes |\n| 5000 | Expenses | Expense | Yes |`
const row=(code,debit='0',credit='0')=>({code,debit,credit})
function book(){let s=newState();const act=(type,payload)=>{s=applyAction(s,{id:`s5-${++sequence}`,type,payload},'Reviewer','2026-11-16T00:00:00Z');return s};act('context',{slot:'glCodes',content:chart});const opening=()=>act('journal',{kind:'opening',date:'2025-12-31',reference:'OPEN',currency:'MYR',evidence:'Approved opening trial balance',lines:[row('1000','1000'),row('3000','0','1000')]});const doc=(reference,kind,amount,date='2026-01-15',currency='MYR')=>{let id=`doc-${++sequence}`;act('document',{kind,reference,date,currency,amount,party:'Partner',bankAccount:'LOCAL-01',evidence:'Verified receipt'});id=s.documents.at(-1).id;act('approve',{documentId:id});return id};const post=(reference,docId,date,lines,currency='MYR')=>act('journal',{kind:'document',reference,date,currency,sourceDocumentId:docId,evidence:'Reviewed source',lines});return{get state(){return s},act,opening,doc,post}}
test('P&L includes only posted activity in an inclusive period, not opening balances',()=>{
 const b=book();b.opening();const income=b.doc('INV-1','sales-invoice','150');b.post('REV-1',income,'2026-01-15',[row('1100','150'),row('4000','0','150')]);const expense=b.doc('PUR-1','purchase-invoice','40','2026-02-01');b.post('EXP-1',expense,'2026-02-01',[row('5000','40'),row('2000','0','40')]);
 const jan=profitAndLoss(b.state,'2026-01-01','2026-01-31');assert.equal(jan.revenue,15000);assert.equal(jan.expense,0);assert.equal(jan.netProfit,15000);assert.equal(jan.journalCount,1);const whole=profitAndLoss(b.state,'2026-01-01','2026-12-31');assert.equal(whole.expense,4000);assert.equal(whole.netProfit,11000);assert.equal(whole.readiness.completeForRecordedSources,true);
})
test('B/S exactly reflects assets = liabilities + posted equity + unclosed earnings',()=>{
 const b=book();b.opening();const sale=b.doc('INV-2','sales-invoice','150');b.post('REV-2',sale,'2026-01-15',[row('1100','150'),row('4000','0','150')]);const purchase=b.doc('PUR-2','purchase-invoice','40','2026-02-01');b.post('EXP-2',purchase,'2026-02-01',[row('5000','40'),row('2000','0','40')]);const s=balanceSheet(b.state,'2026-02-28');assert.equal(s.totalAssets,115000);assert.equal(s.totalLiabilities,4000);assert.equal(s.postedEquity,100000);assert.equal(s.unclosedEarnings,11000);assert.equal(s.totalLiabilitiesAndEquity,115000);assert.equal(s.difference,0);assert.equal(s.balanced,true);assert.equal(trialBalance(b.state,'2026-02-28').debitTotal,trialBalance(b.state,'2026-02-28').creditTotal)
})
test('credit-normal income and debit-normal expense keep their signed contra amounts',()=>{
 const b=book();b.opening();const refund=b.doc('REFUND','sales-invoice','20');b.post('REV-REFUND',refund,'2026-01-15',[row('4000','20'),row('1000','0','20')]);const p=profitAndLoss(b.state,'2026-01-01','2026-12-31');assert.equal(p.revenue,-2000);assert.equal(p.netProfit,-2000);const bs=balanceSheet(b.state,'2026-02-01');assert.equal(bs.totalAssets,98000);assert.equal(bs.unclosedEarnings,-2000);assert.equal(bs.difference,0)
})
test('trial balance net asset contra signs are not truncated in balance sheet',()=>{
 const b=book();b.act('journal',{kind:'opening',date:'2025-12-31',reference:'CONTRA',currency:'MYR',evidence:'Approved opening balance',lines:[row('1000','500'),row('1200','0','100'),row('3000','0','400')]});const s=balanceSheet(b.state,'2026-01-02');assert.equal(s.assets.find(x=>x.code==='1200').balance,-10000);assert.equal(s.totalAssets,40000);assert.equal(s.difference,0)
})
test('reports are isolated by date and currency; CSV detail excludes private evidence URLs',()=>{
 const b=book();b.opening();const d=b.doc('LATE','sales-invoice','30','2026-12-30');b.post('LATE-J',d,'2026-12-30',[row('1100','30'),row('4000','0','30')]);const early=balanceSheet(b.state,'2026-06-30');assert.equal(early.totalAssets,100000);const late=generalLedgerDetail(b.state,'2026-12-30');assert.equal(late.length,4);assert.equal(late.some(x=>Object.hasOwn(x,'evidence')),false);assert.equal(generalLedgerDetail(b.state,'2026-06-30').length,2);assert.equal(profitAndLoss(b.state,'2026-01-01','2026-12-31','USD').netProfit,0)
})
test('unposted source and missing opening keep statement coverage incomplete',()=>{
 const b=book();const d=b.doc('PENDING-JOURNAL','sales-invoice','10');const ready=statementReadiness(b.state,'2026-01-31','MYR');assert.equal(ready.opening,false);assert.equal(ready.unpostedSources,1);assert.equal(ready.completeForRecordedSources,false);b.opening();assert.equal(statementReadiness(b.state,'2026-01-31','MYR').completeForRecordedSources,false);b.post('POSTED',d,'2026-01-15',[row('1100','10'),row('4000','0','10')]);assert.equal(statementReadiness(b.state,'2026-01-31','MYR').completeForRecordedSources,true)
})
test('invalid report dates and periods are rejected',()=>{const b=book();assert.throws(()=>profitAndLoss(b.state,'2026-02-02','2026-02-01'),/cannot be after/);assert.throws(()=>balanceSheet(b.state,'2026-02-30'),/real date/);assert.throws(()=>statementReadiness(b.state,'not-a-date','MYR'),/real date/)})
