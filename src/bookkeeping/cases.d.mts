export const allowedCaseActions:string[];
export function validateCaseActions(actions:unknown):{type:string;payload:Record<string,unknown>}[];
export function resolveActionReferences(value:unknown,caseId:string,index:number):unknown;
