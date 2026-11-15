// All monetary calculations use integer minor units (sen for MYR).
export const financialKinds = ['sales-invoice','purchase-invoice','customer-receipt','supplier-payment','expense-receipt','employee-claim','employee-reimbursement','sales-credit','purchase-credit','customer-refund','supplier-refund','miscellaneous'];
export function minor(value) {
  const s = String(value).trim();
  if (!/^\d{1,11}(\.\d{1,2})?$/.test(s)) throw Error('Enter a non-negative amount with at most two decimals.');
  const [a,b=''] = s.split('.'); const n=Number(a)*100+Number(b.padEnd(2,'0'));
  if (!Number.isSafeInteger(n)) throw Error('Amount is too large.'); return n;
}
export const major = n => (n/100).toFixed(2);
export const newState = () => ({version:1,revision:0,documents:[],allocations:[],reversals:[],goods:[],bankRows:[],matches:[],audit:[],contexts:{profile:'',vendors:'',glCodes:'',policies:''},closedThrough:null});
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
 const s=structuredClone(previous); s.reversals ||= []; const {type,payload:p={}}=action;
 const id=required(action.id,'Action ID');
 if(s.audit.some(e=>e.id===id)) return previous; // Stable action id reused on network retry.
 const effective=p.date || now.slice(0,10);
 if(!['context','reopen','close','reject'].includes(type)) { date(effective); assert(!s.closedThrough||effective>s.closedThrough,'This period is closed. Reopen it with a reason first.'); }
 if(type==='document') {
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
  const allowed=['evidence','note','category','bankAccount'];for(const key of allowed)if(p[key]!==undefined)d[key]=String(p[key]);
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
  p.rows.forEach((r,i)=>{date(r.date);assert(!s.closedThrough||r.date>s.closedThrough,'Statement includes a closed period.');assert(Number.isSafeInteger(r.amount)&&r.amount!==0,'Use nonzero signed integer minor units.');required(r.sourceId,'Statement row ID');assert(!s.bankRows.some(b=>b.account===account&&b.currency===currency&&b.sourceId===r.sourceId),'Duplicate statement row ID for this account.');total+=r.amount;assert(Number.isSafeInteger(total),'Statement balance exceeds supported precision.');s.bankRows.push({id:`${id}-${i}`,account,currency,sourceId:r.sourceId,date:r.date,amount:r.amount,reference:String(r.reference||'')});});
  assert(total===closing,'Statement opening balance plus movements does not equal closing balance.');
 } else if(type==='bank-match') {
  const bank=s.bankRows.find(b=>b.id===p.bankId),d=approved(s,p.documentId);assert(bank,'Bank row not found.');
  assert(!s.matches.some(m=>m.bankId===bank.id||m.documentId===d.id),'This bank row or cash document is already matched.');
  assert(['customer-receipt','supplier-payment','expense-receipt','employee-reimbursement','customer-refund','supplier-refund','miscellaneous'].includes(d.kind),'Match a cash movement, not an invoice.');
  assert(bank.account===d.bankAccount&&bank.currency===d.currency&&bank.amount===(d.direction==='out'?-d.amount:d.amount),'Bank account, currency, direction and exact amount must agree.');
  assert(!s.closedThrough||bank.date>s.closedThrough,'Bank row belongs to a closed period.');s.matches.push({id,bankId:bank.id,documentId:d.id,date:effective});
 } else if(type==='context') {
  assert(['profile','vendors','glCodes','policies'].includes(p.slot),'Invalid context slot.');assert(typeof p.content==='string'&&p.content.length<=524288,'Context is too large.');s.contexts[p.slot]=p.content;
 } else if(type==='close') {
  date(p.date);assert(!s.closedThrough||p.date>s.closedThrough,'Select a later close date.');required(p.reason,'Close review reference');
  assert(!s.documents.some(d=>d.status==='pending'&&d.date<=p.date),'Resolve pending documents before closing.');
  assert(!s.goods.some(g=>!g.resolved&&g.date<=p.date),'Resolve goods claims before closing.');
  assert(!s.bankRows.some(r=>r.date<=p.date&&!s.matches.some(m=>m.bankId===r.id)),'Resolve unmatched bank rows before closing.');
  assert(p.controlsReviewed===true,'Confirm that ledger/control balances and source completeness were reviewed.');s.closedThrough=p.date;
 } else if(type==='reopen') {required(p.reason,'Reopening reason');s.closedThrough=null;
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
