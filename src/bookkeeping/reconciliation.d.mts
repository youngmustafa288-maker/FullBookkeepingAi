import type { BookState,Document } from './engine.mjs'
export interface PartyBalance {party:string;currency:string;invoiceCount:number;openInvoices:number;unallocatedPayments:number;overdue:number;aging:{current:number;days1to30:number;days31to60:number;days61plus:number};documents:{id:string;kind:string;reference:string;date:string;dueDate:string|null;open:number}[]}
export interface PartyBalances {role:string;currency:string;asOf:string;rows:PartyBalance[];openInvoices:number;unallocatedPayments:number;net:number;overdue:number}
export interface SettlementOption {invoiceId:string;paymentId:string;party:string;currency:string;invoiceRef:string;paymentRef:string;invoiceOpen:number;paymentAvailable:number;maxAmount:number;earliestDate:string}
export function partyBalances(state:BookState,role:'customer'|'supplier',asOf?:string,currency?:string):PartyBalances
export function settlementOptions(state:BookState,asOf?:string):SettlementOption[]
export function cashbook(state:BookState,asOf?:string,currency?:string,account?:string):{id:string;reference:string;date:string;party:string;kind:string;bankAccount:string;currency:string;signedAmount:number;posted:boolean;matched:boolean}[]
export function glNet(state:BookState,code:string,currency:string,asOf?:string):number|null
export function controlReconciliation(state:BookState,role:'customer'|'supplier',asOf?:string,currency?:string):{role:string;currency:string;asOf:string;controlCode:string;operationalBalance:number;glBalance:number|null;difference:number|null;unposted:number;opening:boolean;complete:boolean;status:'unmapped'|'incomplete'|'balanced'|'difference'}
export interface BankReconciliation {id:string;account:string;currency:string;opening:number;closing:number;endDate:string;rowCount:number;matched:number;unmatched:number;unmatchedCash:number;missingJournals:number;glCode:string;glClosing:number|null;difference:number|null;complete:boolean;status:'unmapped'|'incomplete'|'balanced'|'difference'}
export function bankReconciliations(state:BookState,asOf?:string,currency?:string):BankReconciliation[]
export function validateControlMapping(state:BookState,role:'customer'|'supplier'|'bank',code:string,account?:string):{code:string;account:string|null}
