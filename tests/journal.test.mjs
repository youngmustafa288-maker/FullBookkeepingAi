import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newState,applyAction,major} from '../src/bookkeeping/engine.mjs'
import {parseChart,trialBalance} from '../src/bookkeeping/ledger.mjs'
const chart=`# Approved GL codes
| Code | Name | Type | Active |
|---|---|---|---|
| 1100 | Accounts receivable | Asset | yes |
| 1000 | Bank account | Asset | yes |
| 2100 | Accounts payable | Liability | yes |
| 4100 | Sales revenue | Revenue | yes |
| 6100 | Office expense | Expense | yes |
| 9999 | Inactive account | Expense | no |`
function book() {
 let state=newState(),seq=0
 function act(type,payload,id){state=applyAction(state,{id:id||`step-${++seq}`,type,payload},'Reviewer','2026-11-16T00:00:00.000Z');return state}
 act('context',{slot:'glCodes',content:chart})
 return {act,get state(){return state}}
}
function sales(b,reference='SI-1',amount='120.00') {
 b.act('document',{kind:'sales-invoice',reference,party:'Customer A',date:'2026-11-01',currency:'MYR',amount,evidence:'Verified original invoice'})
 const doc=b.state.documents.at(-1);b.act('approve',{documentId:doc.id});return doc.id
}
function lines(amount='120.00'){return[{code:'1100',debit:amount},{code:'4100',credit:amount}]}

test('only approved GL chart rows with a known type/active status are accepted',()=>{
 const accounts=parseChart(chart)
 assert.equal(accounts.get('1100').type,'Asset')
 assert.equal(accounts.get('9999').active,false)
 assert.equal(parseChart('- 7777: Unverified expense').size,0)
 assert.throws(()=>parseChart(chart+'\n| 1100 | Duplicate | Asset | yes |'),/Duplicate GL/)
})

test('approved source journal uses balanced integer sen and feeds a dated MYR trial balance',()=>{
 const b=book(),source=sales(b)
 b.act('journal',{kind:'document',sourceDocumentId:source,reference:'J-SI-1',date:'2026-11-01',currency:'MYR',evidence:'Invoice checked against document',lines:lines()})
 const tb=trialBalance(b.state,'2026-11-01','MYR')
 assert.equal(tb.debitTotal,12000)
 assert.equal(tb.creditTotal,12000)
 assert.equal(major(tb.debitTotal),'120.00')
 assert.deepEqual(tb.rows.map(r=>[r.code,r.debit,r.credit]),[['1100',12000,0],['4100',0,12000]])
 assert.equal(trialBalance(b.state,'2026-10-31','MYR').journalCount,0)
 assert.equal(trialBalance(b.state,'2026-11-01','USD').journalCount,0)
})

test('invalid, inactive, mismatched and duplicate journals leave the existing state untouched',()=>{
 const b=book(),source=sales(b),before=b.state
 const base={kind:'document',sourceDocumentId:source,reference:'J-1',date:'2026-11-01',currency:'MYR',evidence:'Invoice reviewed',lines:lines()}
 assert.throws(()=>b.act('journal',{...base,lines:[{code:'1100',debit:'120.00'},{code:'4100',credit:'119.99'}]}),/balance exactly/)
 assert.throws(()=>b.act('journal',{...base,lines:[{code:'1100',debit:'120.00'},{code:'9999',credit:'120.00'}]}),/not an active/)
 assert.throws(()=>b.act('journal',{...base,currency:'USD'}),/currency must match/)
 assert.throws(()=>b.act('journal',{...base,date:'2026-11-02'}),/date must match/)
 assert.throws(()=>b.act('journal',{...base,lines:lines('119.99')}),/total must equal/)
 assert.throws(()=>b.act('journal',{...base,sourceDocumentId:'missing'}),/approved source/)
 assert.equal(b.state,before)
 b.act('journal',base)
 const saved=b.state
 assert.throws(()=>b.act('journal',{...base,reference:'J-2'}),/already has a posted journal/)
 assert.throws(()=>b.act('journal',{...base,reference:'J-3',sourceDocumentId:'missing'}),/approved source/)
 assert.equal(b.state,saved)
})

test('source document alone never invents GL entries or artificial financial statements',()=>{
 const b=book();sales(b)
 assert.equal(trialBalance(b.state).journalCount,0)
 assert.deepEqual(trialBalance(b.state).rows,[])
})

test('opening balances require evidence and only one opening journal per currency',()=>{
 const b=book()
 const opening={kind:'opening',reference:'OB-2026',date:'2026-11-01',currency:'MYR',evidence:'Signed 31 October closing trial balance',lines:[{code:'1000',debit:'5000.00'},{code:'2100',credit:'5000.00'}]}
 assert.throws(()=>b.act('journal',{...opening,evidence:''}),/evidence/)
 b.act('journal',opening)
 assert.equal(trialBalance(b.state,'2026-11-01').debitTotal,500000)
 assert.throws(()=>b.act('journal',{...opening,reference:'OB2'}),/opening journal already exists/)
})

test('reviewed AI case can post source document + journal atomically using earlier-action IDs',()=>{
 const b=book()
 const actions=[
  {type:'document',payload:{kind:'sales-invoice',reference:'CASE-SI',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',sourceDocumentId:'@0',reference:'CASE-GL',date:'2026-11-01',currency:'MYR',evidence:'Reviewed invoice',lines:lines()}}
 ]
 b.act('stage-case',{workflow:'invoice',evidence:'Uploaded original invoice',actions},'case1')
 assert.equal(b.state.journals.length,0)
 assert.throws(()=>b.act('approve-case',{caseId:'case1'}),/explicitly confirm/)
 b.act('edit-case',{caseId:'case1',reviewed:true})
 b.act('approve-case',{caseId:'case1'})
 assert.equal(b.state.journals.length,1)
 assert.equal(b.state.journals[0].sourceDocumentId,'case1:action:0')
 assert.equal(b.state.cases[0].status,'approved')
})

test('bad journal within reviewed case rolls back its newly created source document',()=>{
 const b=book()
 b.act('stage-case',{workflow:'invoice',evidence:'Uploaded original invoice',actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'S2',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',sourceDocumentId:'@0',reference:'J2',date:'2026-11-01',currency:'MYR',evidence:'Invoice',lines:[{code:'1100',debit:'120.00'},{code:'4100',credit:'100.00'}]}}
 ]},'case2')
 const before=b.state
 assert.throws(()=>b.act('edit-case',{caseId:'case2',reviewed:true}),/balance exactly/)
 assert.throws(()=>b.act('approve-case',{caseId:'case2'}),/flagged questions/)
 assert.equal(b.state,before)
 assert.equal(b.state.documents.length,0)
 assert.equal(b.state.journals.length,0)
})

test('posted account type and code cannot be silently deleted or repurposed in company setup',()=>{
 const b=book(),source=sales(b)
 b.act('journal',{kind:'document',sourceDocumentId:source,reference:'POSTED-1',date:'2026-11-01',currency:'MYR',evidence:'Original invoice',lines:lines()})
 const saved=b.state
 assert.throws(()=>b.act('context',{slot:'glCodes',content:chart.replace('| 4100 | Sales revenue | Revenue | yes |','')}),/must remain/)
 assert.throws(()=>b.act('context',{slot:'glCodes',content:chart.replace('| 4100 | Sales revenue | Revenue | yes |','| 4100 | Sales revenue | Expense | yes |')}),/must remain/)
 assert.equal(b.state,saved)
 b.act('context',{slot:'glCodes',content:chart.replace('Sales revenue','Revenue from retail')})
 assert.equal(b.state.journals[0].lines[1].type,'Revenue')
})


test('journal GL errors are identified in review without posting records',()=>{
 const b=book()
 b.act('stage-case',{workflow:'invoice',evidence:'Source invoice',actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'SRC-CODE',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',reference:'GL-CODE',sourceDocumentId:'@0',date:'2026-11-01',currency:'MYR',evidence:'Invoice',lines:[{code:'1100',debit:'120.00'},{code:'7777',credit:'120.00'}]}}
 ]},'code-case')
 assert.match(b.state.cases[0].proposalIssues[0],/not an active approved account/)
 assert.equal(b.state.cases[0].blocked,true)
 assert.equal(b.state.journals.length,0)
 assert.throws(()=>b.act('edit-case',{caseId:'code-case',reviewed:true}),/not an active/)
})

test('a bookkeeper corrects GL coding and amounts, documents the resolution and explicitly approves before posting',()=>{
 const b=book()
 b.act('stage-case',{workflow:'invoice',evidence:'Original invoice',actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'SRC-FIX',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',reference:'GL-FIX',sourceDocumentId:'@0',date:'2026-11-01',currency:'MYR',evidence:'Invoice',lines:[{code:'1100',debit:'120.00'},{code:'9999',credit:'100.00'}]}}
 ]},'fix-case')
 assert.ok(b.state.cases[0].proposalIssues.length)
 assert.throws(()=>b.act('approve-case',{caseId:'fix-case'}),/flagged questions/)
 const correction={index:1,reference:'GL-FIX',date:'2026-11-01',currency:'MYR',evidence:'Verified original invoice and approved sales account',description:'Receivable and income',lines:lines()}
 assert.throws(()=>b.act('edit-case',{caseId:'fix-case',journals:[correction],reviewed:true}),/reviewer note/)
 b.act('edit-case',{caseId:'fix-case',journals:[correction],reviewNote:'Checked sales invoice and GL account 4100 against approved chart.',reviewed:true})
 assert.equal(b.state.cases[0].proposalIssues.length,0)
 assert.equal(b.state.cases[0].reviewed,true)
 assert.equal(b.state.journals.length,0)
 b.act('approve-case',{caseId:'fix-case'})
 assert.equal(b.state.journals.length,1)
 assert.equal(b.state.journals[0].lines[1].code,'4100')
 assert.equal(b.state.journals[0].creditTotal,12000)
 assert.match(b.state.cases[0].reviewNote,/Checked sales invoice/)
 assert.ok(b.state.audit.some(a=>a.type==='edit-case'&&a.payload.reviewNote))
})

test('reviewer cannot tamper with the journal source reference to bypass source approval',()=>{
 const b=book()
 b.act('stage-case',{workflow:'invoice',evidence:'Invoice',actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'SRC-REF',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',reference:'GL-REF',sourceDocumentId:'@0',date:'2026-11-01',currency:'MYR',evidence:'Invoice',lines:lines()}}
 ]},'ref-case')
 b.act('edit-case',{caseId:'ref-case',journals:[{index:1,sourceDocumentId:'bad'}],reviewed:true})
 assert.equal(b.state.cases[0].actions[1].payload.sourceDocumentId,'@0')
 assert.throws(()=>b.act('edit-case',{caseId:'ref-case',journals:[{index:0,lines:lines()}]}),/only an existing proposed journal/i)
})

test('changing the reviewed source amount voids prior journal sign-off',()=>{
 const b=book()
 b.act('stage-case',{workflow:'invoice',evidence:'Invoice',actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'SRC-AMOUNT',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00'}},
  {type:'journal',payload:{kind:'document',reference:'GL-AMOUNT',sourceDocumentId:'@0',date:'2026-11-01',currency:'MYR',evidence:'Invoice',lines:lines()}}
 ]},'amount-case')
 b.act('edit-case',{caseId:'amount-case',reviewed:true})
 b.act('edit-case',{caseId:'amount-case',fields:{amount:'125.00'}})
 assert.equal(b.state.cases[0].reviewed,false)
 assert.match(b.state.cases[0].proposalIssues[0],/source document amount/)
 assert.throws(()=>b.act('approve-case',{caseId:'amount-case'}),/explicitly confirm/)
})

test('editing a blank suggested evidence field cannot erase the private original upload',()=>{
 const b=book()
 const evidence='evidence://bookkeeping-evidence/company/source-invoice.pdf'
 b.act('stage-case',{workflow:'invoice',evidence,actions:[
  {type:'document',payload:{kind:'sales-invoice',reference:'SRC-UP',party:'Customer A',date:'2026-11-01',currency:'MYR',amount:'120.00',evidence:''}},
  {type:'journal',payload:{kind:'document',reference:'GL-UP',sourceDocumentId:'@0',date:'2026-11-01',currency:'MYR',evidence:'GL verified',lines:lines()}}
 ]},'upload-case')
 b.act('edit-case',{caseId:'upload-case',fields:{evidence:'Unverified substitute evidence'},reviewed:true})
 assert.equal(b.state.cases[0].evidence,evidence)
 assert.equal(b.state.cases[0].actions[0].payload.evidence,evidence)
 b.act('approve-case',{caseId:'upload-case'})
 assert.equal(b.state.documents[0].evidence,evidence)
})
