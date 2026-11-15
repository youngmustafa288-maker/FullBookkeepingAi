export const allowedCaseActions=['document','allocate','unallocate','goods','resolve-goods','bank-import','bank-match','edit'];
export function validateCaseActions(actions){
 if(!Array.isArray(actions)||actions.length>20)throw Error('A proposal may contain at most 20 actions.');
 for(const a of actions){if(!a||!allowedCaseActions.includes(a.type)||!a.payload||typeof a.payload!=='object'||Array.isArray(a.payload))throw Error('The proposal contains an unsupported action.');}
 return structuredClone(actions);
}
export function resolveActionReferences(value,caseId,index){
 if(typeof value==='string'&&/^@\d+$/.test(value)){const n=Number(value.slice(1));if(n>=index)throw Error('Proposal links must reference an earlier action.');return `${caseId}:action:${n}`;}
 if(Array.isArray(value))return value.map(v=>resolveActionReferences(v,caseId,index));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolveActionReferences(v,caseId,index)]));
 return value;
}
