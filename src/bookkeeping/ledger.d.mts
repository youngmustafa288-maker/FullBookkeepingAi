import type {BookState,JournalLine} from './engine.mjs'
export type AccountType='Asset'|'Liability'|'Equity'|'Revenue'|'Expense'
export interface ChartAccount {code:string;name:string;type:AccountType;active:boolean}
export interface TrialBalanceRow {code:string;name:string;type:AccountType;debit:number;credit:number}
export function parseChart(markdown?:string):Map<string,ChartAccount>
export function prepareJournal(state:BookState,payload:Record<string,any>,toMinor:(value:string|number)=>number):{reference:string;currency:string;kind:'document'|'opening';sourceDocumentId:string|null;evidence:string;description:string;lines:JournalLine[];debitTotal:number;creditTotal:number}
export function trialBalance(state:BookState,asOf?:string,currency?:string):{currency:string;asOf:string;rows:TrialBalanceRow[];debitTotal:number;creditTotal:number;journalCount:number}
