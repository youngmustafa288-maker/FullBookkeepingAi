import type {BookState} from './engine.mjs'
import type {TrialBalanceRow} from './ledger.mjs'
export interface StatementReadiness {currency:string;asOf:string;opening:boolean;postedJournals:number;approvedSources:number;unpostedSources:number;missingReferences:string[];completeForRecordedSources:boolean}
export interface IncomeRow extends TrialBalanceRow {amount:number}
export interface BalanceRow extends TrialBalanceRow {balance:number}
export function statementReadiness(state:BookState,asOf:string,currency:string):StatementReadiness
export function profitAndLoss(state:BookState,from:string,through:string,currency?:string):{currency:string;from:string;through:string;revenues:IncomeRow[];expenses:IncomeRow[];revenue:number;expense:number;netProfit:number;journalCount:number;readiness:StatementReadiness}
export function balanceSheet(state:BookState,asOf:string,currency?:string):{currency:string;asOf:string;assets:BalanceRow[];liabilities:BalanceRow[];equity:BalanceRow[];totalAssets:number;totalLiabilities:number;postedEquity:number;unclosedEarnings:number;totalEquity:number;totalLiabilitiesAndEquity:number;difference:number;balanced:boolean;journalCount:number;readiness:StatementReadiness}
export function generalLedgerDetail(state:BookState,asOf:string,currency?:string):{date:string;journal:string;kind:string;sourceDocumentId:string;description:string;line:number;accountCode:string;accountName:string;accountType:string;currency:string;debit:number;credit:number}[]
