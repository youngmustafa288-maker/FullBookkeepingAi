export interface ReviewCase { id:string;workflow:'receipt'|'invoice'|'bank-reconciliation'|'reporting';message:string;actions:{type:string;payload:Record<string,unknown>}[];fields:Record<string,string|number>;warnings:string[];missing:string[];blocked:boolean;reviewed:boolean;status:'pending'|'approved'|'rejected';confidence:number|null;evidence:string;filename:string;mimeType:string;queuedAt:string;approvedBy?:string;approvedAt?:string }
export interface Document { id:string;purchaseOrder:string;kind:string;reference:string;party:string;date:string;dueDate:string|null;currency:string;amount:number;status:'pending'|'approved'|'rejected';direction:'in'|'out';bankAccount:string;category:string;originalId:string|null;evidence:string;note:string;approvedBy:string|null }
export interface Allocation { id:string;invoiceId:string;paymentId:string;amount:number;date:string }
export interface Goods { id:string;invoiceId:string;item:string;goodsReceiptRef:string;ordered:number|null;delivered:number;accepted:number;faulty:number;date:string;resolution:string;resolved:boolean;evidence:string;history:unknown[] }
export interface BankRow { id:string;account:string;currency:string;sourceId:string;date:string;amount:number;reference:string }
export interface BookState { version:number;revision:number;cases:ReviewCase[];documents:Document[];allocations:Allocation[];reversals:{id:string;allocationId:string;amount:number;date:string;reason:string}[];goods:Goods[];bankRows:BankRow[];matches:{id:string;bankId:string;documentId:string;date:string}[];audit:{id:string;type:string;actor:string;timestamp:string;reference:string;payload:Record<string,unknown>}[];contexts:Record<'profile'|'vendors'|'glCodes'|'policies',string>;closedThrough:string|null }
export const financialKinds:string[];
export function minor(value:string|number):number;
export function major(value:number):string;
export function newState():BookState;
export function openAmount(state:BookState,id:string,asOf?:string):number;
export function candidates(state:BookState,row:BankRow):Document[];
export function summary(state:BookState,asOf?:string,currency?:string):{receivables:number;payables:number;unallocatedReceipts:number;unallocatedPayments:number;staffPayables:number;unallocatedReimbursements:number;pending:number;disputes:number;unmatched:number};
export function applyAction(state:BookState,action:{id:string;type:string;payload?:Record<string,unknown>},actor?:string,now?:string):BookState;
