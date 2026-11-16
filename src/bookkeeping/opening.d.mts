import type {ChartAccount} from './ledger.mjs'
export interface OpeningGridReview {lines:{code:string;debit:string;credit:string}[];debitTotal:number;creditTotal:number;count:number}
export function csvGrid(text:string):string[][];
export function reviewOpeningGrid(grid:unknown[][],chart:Map<string,ChartAccount>,currency:string,toMinor:(value:string|number)=>number):OpeningGridReview;
