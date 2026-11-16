import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newState,applyAction,minor} from '../src/bookkeeping/engine.mjs'
import {parseChart,trialBalance} from '../src/bookkeeping/ledger.mjs'
import {csvGrid,reviewOpeningGrid} from '../src/bookkeeping/opening.mjs'

const markdown=`| Code | Name | Type | Active |
|---|---|---|---|
| 1000 | Cash at bank | Asset | yes |
| 1100 | Receivable | Asset | yes |
| 2100 | Payable | Liability | yes |
| 3100 | Opening equity | Equity | yes |
| 9999 | Dormant | Expense | no |`
const chart=parseChart(markdown)
const review=(input,currency='MYR')=>reviewOpeningGrid(csvGrid(input),chart,currency,minor)
const opening=`Code,Account,Debit,Credit,Currency
1000,"Cash, at bank","1,200.00",,MYR
1100,Receivable,500.00,,MYR
2100,Payable,,300.00,MYR
3100,Equity,,1400.00,MYR
Total,,1700.00,1700.00,MYR`
function seeded(){return applyAction(newState(),{id:'save-chart',type:'context',payload:{slot:'glCodes',content:markdown}},'Accountant')}

test('CSV parser preserves quotes and multiline cells',()=>{
 const rows=csvGrid('Code,Account,Debit,Credit\r\n1000,"Cash, in bank",1200,\r\n3100,"Opening\nretained equity",,1200')
 assert.equal(rows.length,3)
 assert.equal(rows[1][1],'Cash, in bank')
 assert.equal(rows[2][1],'Opening\nretained equity')
 assert.deepEqual(csvGrid('Code;Debit;Credit\n1000;5.00;\n3100;;5.00').at(1),['1000','5.00',''])
 assert.throws(()=>csvGrid('Code,Debit,Credit\n1000,"not closed,10,'),/unfinished/)
})

test('opening balance import verifies the source CSV with totals, and posts reviewed journal to trial balance',()=>{
 const proposal=review(opening)
 assert.equal(proposal.count,4)
 assert.equal(proposal.debitTotal,170000)
 assert.equal(proposal.creditTotal,170000)
 assert.deepEqual(proposal.lines.find(l=>l.code==='1000'),{code:'1000',debit:'1200.00',credit:'0.00'})
 const original=seeded()
 const posted=applyAction(original,{id:'approve-opening',type:'journal',payload:{kind:'opening',reference:'OPEN-MYR-2026-10-31',date:'2026-10-31',currency:'MYR',evidence:'Verified source file hash and reviewer note',lines:proposal.lines}},'Reviewer')
 assert.equal(posted.audit.at(-1).type,'journal')
 assert.equal(trialBalance(posted,'2026-10-31','MYR').debitTotal,170000)
 assert.equal(trialBalance(posted,'2026-10-30','MYR').journalCount,0)
 assert.equal(trialBalance(posted,'2026-10-31','USD').journalCount,0)
 assert.throws(()=>applyAction(posted,{id:'second-opening',type:'journal',payload:{kind:'opening',reference:'OPEN-AGAIN',date:'2026-10-30',currency:'MYR',evidence:'duplicate',lines:proposal.lines}}),/opening journal already exists/)
})

test('missing header, inactive accounts, bad amounts, negative and duplicate rows are rejected',()=>{
 assert.throws(()=>review('Hello,World\n1000,500'),/Required columns/)
 assert.throws(()=>review('Code,Debit,Credit\n9999,100,\n3100,,100'),/not an active/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,10.001,\n3100,,10'),/invalid debit amount/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,-10,\n3100,,10'),/non-negative/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,10,\n1000,20,\n3100,,30'),/duplicate/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,10,10\n3100,,20'),/both a debit and a credit/)
 assert.throws(()=>review('Code,Debit,Credit\n,10,\n3100,,10'),/account code is missing/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,10,\n3100,,9'),/unbalanced/)
 assert.throws(()=>review('Code,Debit,Credit\n1000,10,\n3100,,10\nTotal,9,10'),/total row/)
 assert.throws(()=>review('Code,Debit,Credit,Currency\n1000,10,,MYR\n3100,,10,USD'),/Import currencies separately/)
})

test('opening balances must predate already posted approved transactions (but may have same date)',()=>{
 let s=seeded()
 s=applyAction(s,{id:'doc1',type:'document',payload:{kind:'sales-invoice',reference:'SI1',party:'Client',date:'2026-11-03',currency:'MYR',amount:'5.00',evidence:'Invoice'}},'Reviewer')
 s=applyAction(s,{id:'doc2',type:'approve',payload:{documentId:'doc1'}},'Reviewer')
 const proposal=review('Code,Debit,Credit\n1000,15,\n3100,,15')
 const base={kind:'opening',date:'2026-11-04',reference:'OPEN',currency:'MYR',evidence:'Prior close trial balance',lines:proposal.lines}
 assert.throws(()=>applyAction(s,{id:'late',type:'journal',payload:base},'Reviewer'),/must be dated no later/)
 assert.equal(s.journals.length,0)
 const corrected=applyAction(s,{id:'early',type:'journal',payload:{...base,date:'2026-11-02'}},'Reviewer')
 assert.equal(corrected.journals.length,1)
})

test('failed validation cannot change booked client data',()=>{
 const s=seeded()
 assert.throws(()=>applyAction(s,{id:'bad-open',type:'journal',payload:{kind:'opening',date:'2026-11-01',reference:'BAL',currency:'MYR',evidence:'Reviewed',lines:[{code:'1000',debit:'5.00'},{code:'3100',credit:'4.99'}]}},'Reviewer'),/balance exactly/)
 assert.equal(s.journals.length,0)
 assert.equal(s.audit.length,1)
})
