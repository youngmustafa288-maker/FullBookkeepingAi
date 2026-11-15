import {createContext,useContext,useMemo,type ReactNode} from 'react'
import {useBookkeeping} from '../bookkeeping/context'
import {openAmount} from '../bookkeeping/engine.mjs'
import type {AuditEvent,GlCode,LedgerRecord,ReviewItem,VendorRule,Client} from '../types'
interface Value {clients:Client[];activeClientId:string;setActiveClientId:(id:string)=>void;records:LedgerRecord[];reviews:ReviewItem[];audit:AuditEvent[];vendorRules:VendorRule[];glCodes:GlCode[];approveReview:(id:string)=>Promise<void>;rejectReview:(id:string,note?:string)=>Promise<void>;addVendorRule:(r:Omit<VendorRule,'id'>)=>void;addGlCode:(r:Omit<GlCode,'id'>)=>void}
const Context=createContext<Value|null>(null)
export function AppProvider({children}:{children:ReactNode}){
 const book=useBookkeeping();const {state,activeClientId}=book
 const value=useMemo<Value>(()=>({clients:book.clients,activeClientId,setActiveClientId:book.setActiveClientId,
 records:state.documents.filter(d=>d.status!=='rejected').map(d=>({id:d.id,clientId:activeClientId,reference:d.reference,type:d.kind==='sales-invoice'?'Sales Invoice':d.kind==='purchase-invoice'?'Purchase Invoice':'Receipt',party:d.party,date:d.date,dueDate:d.dueDate||undefined,amount:(d.kind==='purchase-invoice'?-1:1)*openAmount(state,d.id)/100,status:d.status==='pending'?'Draft':openAmount(state,d.id)===0?'Paid':'Pending',postedBy:d.approvedBy||'Awaiting approval'})),
 reviews:state.documents.filter(d=>d.status==='pending').map(d=>({id:d.id,clientId:activeClientId,workflow:d.kind==='purchase-invoice'||d.kind==='sales-invoice'?'invoice':'receipt',reference:d.reference,party:d.party,amount:d.amount/100,date:d.date,confidence:0,queuedAt:state.audit.find(a=>a.id===d.id)?.timestamp||new Date().toISOString(),filename:d.evidence||'Evidence required',warning:!d.evidence?'Source evidence is required':undefined,fields:{Type:d.kind,Reference:d.reference,Party:d.party,Amount:d.amount/100,Currency:d.currency,Evidence:d.evidence,Note:d.note}})),
 audit:state.audit.map(a=>({id:a.id,clientId:activeClientId,timestamp:a.timestamp,actor:a.actor,actorType:'Human',action:a.type==='approve'?'Approved':a.type==='reject'?'Rejected':'Edited',reference:a.reference||a.type,original:JSON.stringify(a.payload),note:a.type})),
 vendorRules:[],glCodes:[],approveReview:async(id)=>{await book.act('approve',{documentId:id})},rejectReview:async(id,note)=>{await book.act('reject',{documentId:id,reason:note||'Rejected during review'})},addVendorRule:()=>{},addGlCode:()=>{}
 }),[state,activeClientId,book.clients,book.busy])
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useApp(){const v=useContext(Context);if(!v)throw Error('AppProvider required');return v}
