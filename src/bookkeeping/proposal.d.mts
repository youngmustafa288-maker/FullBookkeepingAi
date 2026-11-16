import type {BookState} from './engine.mjs'
export function journalProposalIssues(state:BookState,actions:{type:string;payload:Record<string,unknown>}[],caseId:string,toMinor:(value:string|number)=>number):string[]
