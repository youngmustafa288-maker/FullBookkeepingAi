import {createContext,useContext,useEffect,useState,useRef,type ReactNode} from 'react'
import {applyAction,newState,type BookState} from './engine.mjs'
import {supabase} from '../lib/supabase'
import {clients as exampleClients} from '../data/mockData'
import type {Client} from '../types'
export const localMode=import.meta.env.VITE_BOOKKEEPING_MODE==='local'
const key=(id:string)=>`bookai-v2:${id}`
function load(id:string):BookState { try { const text=localStorage.getItem(key(id));if(text){const value=JSON.parse(text);if(value.version===1)return {...newState(),...value}} }catch{/* Keep an invalid saved file intact; start an empty in-memory workspace. */}return newState() }
async function request(body?:unknown) {
 const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Sign in before accessing company records.')
 const response=await fetch('/api/bookkeeping',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save records.');return data
}
interface Value {clients:Client[];activeClientId:string;setActiveClientId:(id:string)=>void;state:BookState;act:(type:string,payload:Record<string,unknown>,requestId?:string)=>Promise<void>;error:string;busy:boolean;ready:boolean}
const Context=createContext<Value|null>(null)
export function BookkeepingProvider({children}:{children:ReactNode}) {
 const [clients,setClients]=useState<Client[]>(localMode?exampleClients.map(c=>({...c,status:'attention'})):[])
 const [activeClientId,setActive]=useState(localMode?exampleClients[0].id:'')
 const [states,setStates]=useState<Record<string,BookState>>(()=>localMode?Object.fromEntries(exampleClients.map(c=>[c.id,load(c.id)])):{})
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(localMode)
 useEffect(()=>{if(localMode)return;let active=true;const refresh=async()=>{try{const data=await request();if(active){setClients(data.clients);setStates(Object.fromEntries(Object.entries(data.states).map(([id,value])=>[id,{...newState(),...(value as BookState)}])));setActive(old=>old||data.clients[0]?.id||'');setError('');setReady(true)}}catch(e){if(active){setError(e instanceof Error?e.message:'Connection failed');setReady(true)}}};void refresh();const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){setClients([]);setStates({});setActive('');setReady(true)}else{setReady(false);setClients([]);setStates({});setTimeout(()=>void refresh(),0)}});return()=>{active=false;subscription.unsubscribe()}},[])
 const state=states[activeClientId]||newState()
 const statesRef=useRef(states);statesRef.current=states
 const saving=useRef(false),pendingRequest=useRef<{signature:string;id:string}|null>(null)
 const act=async(type:string,payload:Record<string,unknown>,requestId?:string)=>{
  if(saving.current)throw Error('Wait for the current save to finish.');saving.current=true;setBusy(true);setError('');const signature=JSON.stringify({activeClientId,type,payload});if(!requestId){if(pendingRequest.current?.signature===signature)requestId=pendingRequest.current.id;else{requestId=crypto.randomUUID();pendingRequest.current={signature,id:requestId}}}
  try {const action={id:requestId,type,payload};let updated:BookState
   if(localMode){updated=applyAction(statesRef.current[activeClientId]||newState(),action,'Local bookkeeper');localStorage.setItem(key(activeClientId),JSON.stringify(updated))}
   else {const response=await request({companyId:activeClientId,revision:(statesRef.current[activeClientId]||newState()).revision,action});updated=response.state}
   statesRef.current={...statesRef.current,[activeClientId]:updated};setStates(statesRef.current);pendingRequest.current=null
  }catch(e){const message=e instanceof Error?e.message:'Save failed';setError(message);throw e}finally{saving.current=false;setBusy(false)}
 }
 return <Context.Provider value={{clients,activeClientId,setActiveClientId:setActive,state,act,error,busy,ready}}>{children}</Context.Provider>
}
export function useBookkeeping(){const value=useContext(Context);if(!value)throw Error('BookkeepingProvider is required');return value}
