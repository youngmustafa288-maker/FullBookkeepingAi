import type {VercelRequest,VercelResponse} from '@vercel/node'
import {authorise} from '../server/bookkeeping-auth'
import {requireSuccessfulRead,requireWorkspaceState} from '../server/bookkeeping-read.mjs'
import {applyAction,newState} from '../src/bookkeeping/engine.mjs'
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store')
 try{
  if(req.method==='GET'){
   const {userDb}=await authorise(req)
   const companies=requireSuccessfulRead(await userDb.from('companies').select('id,name,currency,tax_regime'),'company list')
   const ids=companies.map(c=>c.id)
   let rows:any[]=[]
   if(ids.length){
     rows=requireSuccessfulRead(await userDb.from('bookkeeping_workspaces').select('company_id,state').in('company_id',ids),'company workspaces')
   }
   const states=Object.fromEntries(companies.map(c=>[c.id,requireWorkspaceState(rows.find(r=>r.company_id===c.id),newState)]))
   return res.json({
     clients:companies.map(c=>({
       id:c.id,
       name:c.name||'Company',
       shortName:(c.name||'CO').split(' ').filter(Boolean).map((v:string)=>v[0]).join('').slice(0,2).toUpperCase()||'CO',
       color:'#8aafa2',
       status:'connected',
       currency:c.currency||'MYR',
       taxRegime:c.tax_regime==='SST'?'SST':'Exempt',
       entityNumber:''
     })),
     states
   })
  }
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'})
  const {companyId,revision,action}=req.body||{}
  if(typeof companyId!=='string'||!Number.isSafeInteger(revision)||!action||typeof action.id!=='string'||JSON.stringify(action).length>1_500_000)return res.status(400).json({error:'Invalid company, revision or action.'})
  const {user,admin}=await authorise(req,companyId);if(!admin)return res.status(503).json({error:'Configure the server-only service role key to save company records.'})
  const {data,error}=await admin.from('bookkeeping_workspaces').select('state').eq('company_id',companyId).maybeSingle();if(error)throw error
  const current=requireWorkspaceState(data,newState)
  if(current.audit.some((a:{id:string})=>a.id===action.id))return res.json({state:current,idempotent:true})
  if(current.revision!==revision)return res.status(409).json({error:'Records changed in another session. Reload before retrying.'})
  const updated=applyAction(current,action,user.id)
  const {error:saveError}=await admin.rpc('save_bookkeeping_workspace',{target_company:companyId,expected_revision:revision,new_state:updated})
  if(saveError)return res.status(409).json({error:'Save conflict. Reload company records and retry with the same action ID.'})
  return res.json({state:updated,external_posted:false})
 }catch(e){
   console.error('Bookkeeping API handler error:', e)
   const err=e as Error&{status?:number}
   const status=typeof err?.status==='number'&&err.status>=400&&err.status<600?err.status:500
   return res.status(status).json({error:err?.message||'Operation failed.'})
 }
}
