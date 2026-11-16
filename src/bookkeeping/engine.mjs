import {validateCaseActions,resolveActionReferences} from './cases.mjs'
import {prepareJournal,parseChart} from './ledger.mjs'
import {journalProposalIssues} from './proposal.mjs'
import {validateControlMapping} from './reconciliation.mjs'
import {closingReadiness} from './closing.mjs'
// All monetary calculations use integer minor units (sen for MYR).
export const financialKinds = ['sales-invoice','purchase-invoice','customer-receipt','supplier-payment','expense-receipt','employee-claim','employee-reimbursement','sales-credit','purchase-credit','customer-refund','supplier-refund','miscellaneous'];
export function minor(value) {
  const s = String(value).trim();
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(s)) throw Error('Enter a non-negative amount with at most two decimals.');
  const [a,b=''] = s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0'));
  if (!Number.isSafeInteger(n)) throw Error('Amount is too large.'); return n;
}
export const major = n => (n/100).toFixed(2);
export const newState = () => ({version:1,revision:0,cases:[],documents:[],allocations:[],reversals:[],goods:[],bankRows:[],bankStatements:[],matches:[],journals:[],controlAccounts:{customer:'',supplier:'',banks:{}},periodCloses:[],audit:[],contexts:{profile:'',vendors:'',glCodes:'',policies:''},closedThrough:null});
function assert(ok,msg) { if(!ok) throw Error(msg); }
function date(value) { assert(/^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value,'Use a valid YYYY-MM-DD date.'); return value; }
function required(value,label) { assert(typeof value==='string' && value.trim().length>0 && value.length<=200,`${label} is required (maximum 200 characters).`); return value.trim(); }
function approved(s,id) { const d=s.documents.find(d=>d.id===id); assert(d?.status==='approved','Choose an approved document.'); return d; }
export function openAmount(s,id,asOf='9999-12-31') {
 const d=s.documents.find(d=>d.id===id); if(!d || d.status!=='approved' || d.date>asOf) return 0;
 let used=s.allocations.filter(a=>(a.invoiceId===id||a.paymentId===id) && a.date<=asOf).reduce((v,a)=>v+a.amount-(s.reversals||[]).filter(r=>r.allocationId===a.id&&r.date<=asOf).reduce((n,r)=>n+r.amount,0),0);
 const credits=s.documents.filter(c=>c.status==='approved' && c.originalId===id && c.date<=asOf && ['sales-credit','purchase-credit','customer-refund','supplier-refund'].includes(c.kind)).reduce((v,c)=>v+c.amount,0);
 return d.amount-used-credits;
}
function pair(invoice,payment) {
 const types = invoice.kind==='sales-invoice' ? ['customer-receipt'] : invoice.kind==='purchase-invoice' ? ['supplier-payment'] : invoice.kind==='employee-claim' ? ['employee-reimbursement'] : [];
 assert(types.includes(payment.kind),'Allocate customer receipts to sales invoices and supplier payments to purchase invoices.');
 assert(invoice.party.trim().toLowerCase()===payment.party.trim().toLowerCase(),'Counterparties must match.');
 assert(invoice.currency===payment.currency,'Currency conversion requires a separate supported adjustment.');
}
export function candidates(s,row) {
 // Exact signed amount, currency, account, date window AND reference; ambiguous results stay unresolved.
 return s.documents.filter(d=>d.status==='approved' && ['customer-receipt','supplier-payment','expense-receipt','employee-reimbursement','customer-refund','supplier-refund','miscellaneous'].includes(d.kind)
  && d.bankAccount===row.account && d.currency===row.currency && (d.direction==='out'?-d.amount:d.amount)===row.amount
  && Math.abs(Date.parse(d.date)-Date.parse(row.date))<=3*86400000 && row.reference && d.reference.toLowerCase()===row.reference.toLowerCase()
  && !s.matches.some(m=>m.documentId===d.id));
}
export function summary(s,asOf='9999-12-31',currency='MYR') {
 const docs=s.documents.filter(d=>d.status==='approved' && d.date<=asOf && d.currency===currency);
 const total=kind=>docs.filter(d=>d.kind===kind).reduce((n,d)=>n+openAmount(s,d.id,asOf),0);
 return {receivables:total('sales-invoice'),payables:total('purchase-invoice'),unallocatedReceipts:total('customer-receipt'),unallocatedPayments:total('supplier-payment'),staffPayables:total('employee-claim'),unallocatedReimbursements:total('employee-reimbursement'),pending:s.documents.filter(d=>d.status==='pending').length,disputes:s.goods.filter(g=>!g.resolved && g.faulty>0).length,unmatched:s.bankRows.filter(r=>!s.matches.some(m=>m.bankId===r.id)).length};
}
export function applyAction(previous,action,actor='Bookkeeper',now=new Date().toISOString()) {
 let s=structuredClone(previous); s.reversals ||= []; s.cases ||= []; s.journals ||= []; s.bankStatements ||= []; s.controlAccounts ||= {customer:'',supplier:'',banks:{}}; s.periodCloses ||= []; const {type,payload:p={}}=action;
 const id=required(action.id,'Action ID');
 if(s.audit.some(e=>e.id===id)) return previous; // Stable action id reused on network retry.
 const effective=p.date || now.slice(0,10);
 if(!['context','reopen','close','reject','stage-case','edit-case','reject-case','control-map'].includes(type)) { date(effective); assert(!s.closedThrough||effective>s.closedThrough,'This period is closed. Reopen it with a reason first.'); }
 if(type==='stage-case') {
  const actions=validateCaseActions(p.actions||[]);
  const fields=p.fields&&typeof p.fields==='object'?p.fields:{};
  const proposalIssues=journalProposalIssues(s,actions,id,minor);
  s.cases.push({id,proposalIssues,reviewNote:'',workflow:['receipt','invoice','bank-reconciliation','reporting'].includes(p.workflow)?p.workflow:'invoice',message:String(p.message||''),actions,fields:structuredClone(fields),warnings:Array.isArray(p.warnings)?p.warnings.map(String):[],missing:Array.isArray(p.missing)?p.missing.map(String):[],blocked:Boolean(p.blocked)||!actions.length||(Array.isArray(p.missing)&&p.missing.length>0)||proposalIssues.length>0,reviewed:false,status:'pending',confidence:typeof p.confidence==='number'?Math.min(100,Math.max(0,p.confidence)):null,evidence:String(p.evidence||''),filename:String(p.filename||'Chat proposal'),mimeType:String(p.mimeType||''),queuedAt:now});
 } else if(type==='edit-case') {
  const c=s.cases.find(c=>c.id===p.caseId);assert(c?.status==='pending','Only a pending case can be corrected.');
  if(p.fields&&typeof p.fields==='object'){
   for(const [key,value] of Object.entries(p.fields))if(['reference','party','date','dueDate','amount','currency','category','bankAccount','evidence','note','originalId'].includes(key)){
    const first=c.actions.find(a=>a.type==='document');
    // Once a private uploaded source is linked, editable proposal fields must
    // not swap it for a new string. The reviewer can add separate GL evidence.
    if(key==='evidence' && c.evidence.startsWith('evidence://bookkeeping-evidence/')){
     c.fields[key]=c.evidence;if(first)first.payload[key]=c.evidence;
     continue;
    }
    c.fields[key]=String(value);
    if(first)first.payload[key]=String(value);
    if(key==='evidence' && String(value).trim())c.evidence=String(value);
   }
  }
  if(p.journals!==undefined){
   assert(Array.isArray(p.journals)&&p.journals.length<=20,'Invalid journal correction batch.');
   const seen=new Set();
   for(const patch of p.journals){
    assert(patch&&Number.isSafeInteger(patch.index)&&!seen.has(patch.index),'Each journal correction must target one distinct action index.');
    seen.add(patch.index);
    const target=c.actions[patch.index];assert(target?.type==='journal','Only an existing proposed journal can be corrected.');
    const next={...target.payload};
    for(const key of ['reference','date','currency','description','evidence'])if(Object.hasOwn(patch,key))next[key]=String(patch[key]);
    if(Object.hasOwn(patch,'lines')){
     assert(Array.isArray(patch.lines)&&patch.lines.length>=2&&patch.lines.length<=100,'A journal needs 2–100 lines.');
     next.lines=patch.lines.map(line=>{
      assert(line&&typeof line==='object'&&!Array.isArray(line),'Invalid corrected journal line.');
      return {code:String(line.code||''),debit:String(line.debit??'0'),credit:String(line.credit??'0')};
     });
    }
    target.payload=next;
   }
  }
  c.proposalIssues=journalProposalIssues(s,c.actions,c.id,minor);
  if(p.reviewNote!==undefined){assert(typeof p.reviewNote==='string'&&p.reviewNote.length<=2000,'Review note is too long.');c.reviewNote=p.reviewNote.trim();}
  if(p.reviewed===true){
   assert(c.actions.length>0,'Ask AI to prepare a supported action before approval.');
   assert(c.proposalIssues.length===0,c.proposalIssues[0]||'Correct the journal before approval.');
   if(c.blocked)assert(c.reviewNote||c.fields.note,'Explain how the flagged questions were resolved in a reviewer note.');
   c.reviewed=true;c.blocked=false;
  } else if(p.journals!==undefined || p.fields!==undefined){
   // Any substantive change cancels an earlier journal sign-off.
   if(c.actions.some(a=>a.type==='journal'))c.reviewed=false;
  }
 } else if(type==='reject-case') {
  const c=s.cases.find(c=>c.id===p.caseId);assert(c?.status==='pending','Only a pending case can be rejected.');c.status='rejected';c.rejectionReason=required(p.reason,'Rejection reason');
 } else if(type==='approve-case') {
  const c=s.cases.find(c=>c.id===p.caseId);assert(c?.status==='pending','This case is no longer pending.');assert(!c.blocked&&c.actions.length>0,'Resolve the flagged questions in full review before approval.');
  const actions=validateCaseActions(c.actions),caseId=c.id,evidence=c.evidence;
  if(actions.some(a=>a.type==='journal')){
   assert(c.reviewed===true,'Open full review and explicitly confirm the proposed journal before approval.');
   const issues=journalProposalIssues(s,actions,caseId,minor);assert(issues.length===0,issues[0]||'Correct the proposed journal before approval.');
  }
  for(let i=0;i<actions.length;i++){
   const a=actions[i],payload=resolveActionReferences(a.payload,caseId,i),actionId=`${caseId}:action:${i}`;
   if(a.type==='document')payload.evidence=payload.evidence||evidence;
   s=applyAction(s,{id:actionId,type:a.type,payload},actor,now);
   if(a.type==='document')s=applyAction(s,{id:`${actionId}:approved`,type:'approve',payload:{documentId:actionId}},actor,now);
  }
  const saved=s.cases.find(c=>c.id===caseId);saved.status='approved';saved.approvedBy=actor;saved.approvedAt=now;
  s.revision=previous.revision;
 } else if(type==='document') {
  assert(financialKinds.includes(p.kind),'Unsupported document type.');
  const reference=required(p.reference,'Reference'), party=required(p.party,'Customer / supplier / other party');
  const currency=String(p.currency||'MYR').toUpperCase(); assert(/^[A-Z]{3}$/.test(currency),'Use a three-letter currency code.');
  assert(!s.documents.some(d=>d.status!=='rejected' && d.kind===p.kind && d.party.toLowerCase()===party.toLowerCase() && d.reference.toLowerCase()===reference.toLowerCase() && d.currency===currency),'Possible duplicate: this party, document type, reference and currency already exist.');
  const amount=minor(p.amount);assert(amount>0,'Amount must be greater than zero.');
  if(p.dueDate)date(p.dueDate);
  s.documents.push({id,kind:p.kind,reference,party,purchaseOrder:String(p.purchaseOrder||''),date:date(p.date),dueDate:p.dueDate||null,currency,amount,status:'pending',direction:['customer-receipt','supplier-refund','sales-invoice'].includes(p.kind)?'in':p.kind==='miscellaneous'&&p.direction==='in'?'in':'out',bankAccount:String(p.bankAccount||''),category:String(p.category||''),originalId:p.originalId||null,evidence:String(p.evidence||''),note:String(p.note||''),approvedBy:null});
 } else if(type==='approve') {
  const d=s.documents.find(d=>d.id===p.documentId);assert(d?.status==='pending','This document is not pending approval.');
  assert(!s.closedThrough||d.date>s.closedThrough,'The document period is closed.');
  assert(d.evidence.trim(),'Add a source document reference or evidence note before approval.');
  if(['sales-credit','purchase-credit'].includes(d.kind)) {
   const original=approved(s,d.originalId);assert(original.kind===(d.kind==='sales-credit'?'sales-invoice':'purchase-invoice'),'Select the matching original invoice.');
   assert(original.party.toLowerCase()===d.party.toLowerCase() && original.currency===d.currency,'Original invoice party/currency mismatch.');
   assert(d.date>=original.date,'Credit date cannot precede the original invoice.');
   const prior=s.documents.filter(c=>c.status==='approved'&&c.originalId===original.id).reduce((n,c)=>n+c.amount,0);
   assert(prior+d.amount<=original.amount,'Credits exceed the original invoice.');
   assert(d.amount<=openAmount(s,original.id),'Unallocate the relevant payment before approving this credit; retain the excess as unallocated money.');
  }
  if(['customer-refund','supplier-refund'].includes(d.kind)) {
   const original=approved(s,d.originalId);assert(original.kind===(d.kind==='customer-refund'?'customer-receipt':'supplier-payment'),'Link the original receipt or payment.');
   assert(original.party.toLowerCase()===d.party.toLowerCase() && original.currency===d.currency,'Refund party/currency mismatch.');
   assert(d.date>=original.date,'Refund cannot precede the original payment.');
   assert(d.amount<=openAmount(s,original.id),'Refund exceeds the available unallocated payment.');
  }
  d.status='approved';d.approvedBy=actor;
 } else if(type==='edit') {
  const d=s.documents.find(d=>d.id===p.documentId);assert(d?.status==='pending','Only pending documents can be edited.');
  const allowed=['reference','party','date','dueDate','currency','evidence','note','category','bankAccount','originalId'];for(const key of allowed)if(p[key]!==undefined)d[key]=String(p[key]);
  if(p.amount!==undefined){d.amount=minor(p.amount);assert(d.amount>0,'Amount must be positive.');}
  required(d.reference,'Reference');required(d.party,'Counterparty');date(d.date);if(d.dueDate)date(d.dueDate);assert(/^[A-Z]{3}$/.test(d.currency),'Use a three-letter currency code.');assert(!s.closedThrough||d.date>s.closedThrough,'Document date is in a closed period.');
  assert(!s.documents.some(other=>other.id!==d.id&&other.status!=='rejected'&&other.kind===d.kind&&other.party.toLowerCase()===d.party.toLowerCase()&&other.reference.toLowerCase()===d.reference.toLowerCase()&&other.currency===d.currency),'Duplicate document identity after correction.');
 } else if(type==='reject') {
  const d=s.documents.find(d=>d.id===p.documentId);assert(d?.status==='pending','Only pending documents can be rejected.');d.status='rejected';d.note=required(p.reason,'Rejection reason');
 } else if(type==='allocate') {
  const invoice=approved(s,p.invoiceId),payment=approved(s,p.paymentId);pair(invoice,payment);
  const amount=minor(p.amount);assert(amount>0,'Allocation must be positive.');date(p.date);
  assert(p.date>=invoice.date && p.date>=payment.date,'Allocation cannot precede either document.');
  assert(amount<=openAmount(s,invoice.id),'Allocation exceeds the invoice balance.');
  assert(amount<=openAmount(s,payment.id),'Allocation exceeds available payment.');
  s.allocations.push({id,invoiceId:invoice.id,paymentId:payment.id,amount,date:p.date});
 } else if(type==='unallocate') {
  const a=s.allocations.find(a=>a.id===p.allocationId);assert(a,'Allocation not found.');assert(!s.closedThrough||a.date>s.closedThrough,'Allocation belongs to a closed period.');required(p.reason,'Unallocation reason');assert(effective>=a.date,'Release date cannot precede allocation.');const remaining=a.amount-s.reversals.filter(r=>r.allocationId===a.id).reduce((n,r)=>n+r.amount,0);const amount=p.amount?minor(p.amount):remaining;assert(amount>0&&amount<=remaining,'Release exceeds the remaining allocation.');s.reversals.push({id,allocationId:a.id,amount,date:effective,reason:p.reason});
 } else if(type==='goods') {
  const invoice=approved(s,p.invoiceId);assert(invoice.kind==='purchase-invoice','Select an approved supplier invoice.');
  const delivered=Number(p.delivered),accepted=Number(p.accepted),faulty=Number(p.faulty);
  if(p.ordered)assert(Number.isSafeInteger(Number(p.ordered))&&Number(p.ordered)>=0,'Ordered quantity must be a non-negative whole number.');
  assert(!p.goodsReceiptRef||!s.goods.some(g=>g.invoiceId===p.invoiceId&&g.item===p.item&&g.goodsReceiptRef===p.goodsReceiptRef),'Duplicate item inspection for this goods receipt.');
  assert([delivered,accepted,faulty].every(n=>Number.isSafeInteger(n)&&n>=0)&&delivered>0&&accepted+faulty===delivered,'Delivered must equal accepted plus faulty whole units.');
  s.goods.push({id,invoiceId:invoice.id,item:required(p.item,'Item'),goodsReceiptRef:String(p.goodsReceiptRef||''),ordered:p.ordered?Number(p.ordered):null,delivered,accepted,faulty,date:date(p.date),resolution:p.resolution||'claim-pending',resolved:faulty===0,evidence:required(p.evidence,'Inspection evidence'),history:[]});
 } else if(type==='resolve-goods') {
  const g=s.goods.find(g=>g.id===p.goodsId);assert(g&&!g.resolved,'Choose an unresolved goods claim.');
  assert(['replacement-received','credit-received','refund-received','claim-rejected'].includes(p.resolution),'Choose a supported resolution.');
  required(p.evidence,'Resolution evidence');
  if(p.resolution==='credit-received') { const credit=approved(s,p.documentId);assert(credit.kind==='purchase-credit'&&credit.originalId===g.invoiceId,'Link an approved supplier credit for this invoice.'); }
  if(p.resolution==='refund-received') { const refund=approved(s,p.documentId),invoice=approved(s,g.invoiceId);assert(refund.kind==='supplier-refund'&&refund.party.toLowerCase()===invoice.party.toLowerCase()&&refund.currency===invoice.currency,'Link the related approved supplier refund.'); }
  g.resolved=true;g.resolution=p.resolution;g.history.push({date:effective,resolution:p.resolution,evidence:p.evidence,documentId:p.documentId||null,actor});
 } else if(type==='bank-import') {
  assert(Array.isArray(p.rows)&&p.rows.length>0&&p.rows.length<=5000,'Import between 1 and 5,000 statement rows.');
  const account=required(p.account,'Bank account'),currency=required(p.currency,'Currency').toUpperCase();assert(/^[A-Z]{3}$/.test(currency),'Use a three-letter currency code.');
  const opening=Number(p.opening),closing=Number(p.closing);assert(Number.isSafeInteger(opening)&&Number.isSafeInteger(closing),'Opening/closing balances must be integer minor units.');
  let total=opening;
  p.rows.forEach((r,i)=>{date(r.date);assert(!s.closedThrough||r.date>s.closedThrough,'Statement includes a closed period.');assert(Number.isSafeInteger(r.amount)&&r.amount!==0,'Use nonzero signed integer minor units.');required(r.sourceId,'Statement row ID');assert(!s.bankRows.some(b=>b.account===account&&b.currency===currency&&b.sourceId===r.sourceId),'Duplicate statement row ID for this account.');total+=r.amount;assert(Number.isSafeInteger(total),'Statement balance exceeds supported precision.');s.bankRows.push({id:`${id}-${i}`,statementId:id,account,currency,sourceId:r.sourceId,date:r.date,amount:r.amount,reference:String(r.reference||'')});});
  assert(total===closing,'Statement opening balance plus movements does not equal closing balance.');
  const endDate=p.rows.reduce((d,r)=>r.date>d?r.date:d,'0000-00-00');
  s.bankStatements.push({id,account,currency,opening,closing,endDate,rowCount:p.rows.length});
 } else if(type==='bank-match') {
  const bank=s.bankRows.find(b=>b.id===p.bankId),d=approved(s,p.documentId);assert(bank,'Bank row not found.');
  assert(!s.matches.some(m=>m.bankId===bank.id||m.documentId===d.id),'This bank row or cash document is already matched.');
  assert(['customer-receipt','supplier-payment','expense-receipt','employee-reimbursement','customer-refund','supplier-refund','miscellaneous'].includes(d.kind),'Match a cash movement, not an invoice.');
  assert(bank.account===d.bankAccount&&bank.currency===d.currency&&bank.amount===(d.direction==='out'?-d.amount:d.amount),'Bank account, currency, direction and exact amount must agree.');
  assert(!s.closedThrough||bank.date>s.closedThrough,'Bank row belongs to a closed period.');
  assert(effective>=bank.date,'Match review date cannot precede the bank transaction.');
  if(!candidates(s,bank).some(candidate=>candidate.id===d.id))required(p.reviewNote,'Reason for manual bank match');
  s.matches.push({id,bankId:bank.id,documentId:d.id,date:effective,reviewNote:String(p.reviewNote||'').slice(0,1000)});
 } else if(type==='control-map') {
  assert(!s.closedThrough,'Reopen the closed period with a reason before changing GL control mappings.');
  const {code,account}=validateControlMapping(s,p.role,p.code,p.account);
  if(p.role==='bank')s.controlAccounts.banks[account]=code;
  else s.controlAccounts[p.role]=code;
 } else if(type==='journal') {
  const entry=prepareJournal(s,p,minor);
  s.journals.push({id,date:date(p.date),...entry,postedBy:actor,postedAt:now});
 } else if(type==='context') {
  if(['glCodes','policies'].includes(p.slot)) assert(!s.closedThrough,'Reopen the closed period with a reason before changing historical accounting configuration.');
  assert(['profile','vendors','glCodes','policies'].includes(p.slot),'Invalid context slot.');assert(typeof p.content==='string'&&p.content.length<=524288,'Context is too large.');
  if(p.slot==='glCodes'&&s.journals.length){
   const newChart=parseChart(p.content);
   for(const line of s.journals.flatMap(j=>j.lines)){
    const entry=newChart.get(line.code);assert(entry&&entry.type===line.type,`Existing posted account ${line.code} must remain in the chart with its original accounting type.`);
   }
  }
  if(p.slot==='glCodes') {
   const reviewState={...s,contexts:{...s.contexts,glCodes:p.content}};
   for(const role of ['customer','supplier'])if(s.controlAccounts[role])validateControlMapping(reviewState,role,s.controlAccounts[role]);
   for(const [account,code] of Object.entries(s.controlAccounts.banks))validateControlMapping(reviewState,'bank',code,account);
  }
  s.contexts[p.slot]=p.content;
 } else if(type==='close') {
  date(p.date);required(p.reason,'Close review reference');
  assert(p.controlsReviewed===true,'Confirm you reviewed the recorded ledger, source completeness and control balances.');
  assert(p.adjustmentsReviewed===true,'Confirm manual review of accruals, tax, depreciation and other applicable month-end adjustments.');
  const currency=String(p.currency||'MYR').toUpperCase();
  const malaysiaToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const pack=closingReadiness(s,p.date,currency,malaysiaToday);
  assert(pack.ready,`Month-end close blocked: ${pack.blocking[0]?.label}: ${pack.blocking[0]?.detail}`);
  s.periodCloses.push({id,date:p.date,priorThrough:s.closedThrough||null,reason:p.reason.trim(),currency,closedAt:now,closedBy:actor,checks:structuredClone(pack.checks),currencies:pack.currencies,review:{controls:true,adjustments:true},reopenedAt:null,reopenedBy:null,reopenReason:null});
  s.closedThrough=p.date;
 } else if(type==='reopen') {
  const reason=required(p.reason,'Reopening reason');assert(s.closedThrough,'No closed period to reopen.');
  const latest=[...s.periodCloses].reverse().find(c=>c.date===s.closedThrough&&!c.reopenedAt);
  if(latest){latest.reopenedAt=now;latest.reopenedBy=actor;latest.reopenReason=reason;s.closedThrough=latest.priorThrough;}
  else s.closedThrough=null; // Safely unlock a pre-Step-6 legacy close without fabricating history.
 } else throw Error('Unsupported action.');
 // Prevent backdated changes from creating negative balances at any later event date.
 const affected=new Set();
 if(type==='allocate'){affected.add(p.invoiceId);affected.add(p.paymentId)}
 if(type==='unallocate'){const a=s.allocations.find(a=>a.id===p.allocationId);if(a){affected.add(a.invoiceId);affected.add(a.paymentId)}}
 if(type==='approve'){const d=s.documents.find(d=>d.id===p.documentId);if(d?.originalId)affected.add(d.originalId)}
 for(const target of affected){
  const links=s.allocations.filter(a=>a.invoiceId===target||a.paymentId===target),linkIds=new Set(links.map(a=>a.id));
  const dates=new Set([...links.map(a=>a.date),...s.reversals.filter(r=>linkIds.has(r.allocationId)).map(r=>r.date),...s.documents.filter(d=>d.status==='approved'&&(d.id===target||d.originalId===target)).map(d=>d.date)]);
  for(const when of dates)assert(openAmount(s,target,when)>=0,'This dated change would overdraw a historical invoice or payment balance. Correct the event dates or allocations first.');
 }
 s.revision++;s.audit.push({id,type,actor,timestamp:now,reference:p.reference||p.documentId||p.invoiceId||'',payload:structuredClone(p)});return s;
}
