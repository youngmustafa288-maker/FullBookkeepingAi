import {useRef,useState,type DragEvent} from 'react'
import {AlertTriangle,CheckCircle2,Loader2,UploadCloud} from 'lucide-react'
import {useApp} from '../context/AppContext'
import {useBookkeeping} from '../bookkeeping/context'
import {apiPost,fileToBase64} from '../lib/api'

type ConfigType='glCodes'|'vendors'|'policies'|'profile'
const slots:ConfigType[]=['profile','glCodes','vendors','policies']
interface Upload{name:string;status:'analyzing'|'done'|'error';message?:string}

export function Configuration(){
 const {clients,activeClientId}=useApp()
 const {state,act,error}=useBookkeeping()
 const client=clients.find(c=>c.id===activeClientId)!
 const [uploading,setUploading]=useState<Upload[]>([])
 const [problem,setProblem]=useState('')
 const [working,setWorking]=useState(false)
 const fileRef=useRef<HTMLInputElement>(null)
 const workingRef=useRef(false)

 const files=async(input:FileList|File[])=>{
  if(workingRef.current)return
  const batch=Array.from(input)
  if(batch.length>20){setProblem('Choose up to 20 files.');return}
  setProblem('')
  setUploading(batch.map(f=>({name:f.name,status:'analyzing'})))
  setWorking(true)
  workingRef.current=true
  let draftContext={...state.contexts}
  try{
   for(let i=0;i<batch.length;i++){
    const file=batch[i]
    try{
     if(file.size>3_000_000)throw Error('Choose a file below 3 MB.')
     if(!/\.(csv|xlsx|pdf|jpe?g|png|md|txt)$/i.test(file.name))throw Error('Use CSV, XLSX, PDF, an image, Markdown or text.')
     const response=await apiPost('generate-config',{documentBase64:await fileToBase64(file),mimeType:file.type,fileName:file.name,clientId:activeClientId,configType:'all',draftContext})
     const generated=Object.fromEntries(slots.filter(slot=>typeof response.configs?.[slot]==='string'&&response.configs[slot].trim()).map(slot=>[slot,response.configs[slot] as string])) as Partial<Record<ConfigType,string>>
     for(const slot of slots){
      const content=generated[slot]
      if(content&&content!==draftContext[slot])await act('context',{slot,content})
     }
     draftContext={...draftContext,...generated}
     const message=Object.keys(generated).length?'File processed and client setup updated.':'File processed. No new setup information was found.'
     setUploading(old=>old.map((u,n)=>n===i?{...u,status:'done',message}:u))
    }catch(e){
     setUploading(old=>old.map((u,n)=>n===i?{...u,status:'error',message:e instanceof Error?e.message:'Analysis failed.'}:u))
    }
   }
  }finally{
   workingRef.current=false
   setWorking(false)
   if(fileRef.current)fileRef.current.value=''
  }
 }

 return <div className="page-stack">
  <section className="page-intro page-intro--compact"><div><span className="eyebrow">Client configuration</span><h2>Business setup</h2><p>Upload {client.name}'s existing company and accounting records. BookAI will process them for this client workspace.</p></div><div className="scope-pill"><span className="client-avatar" style={{background:client.color}}>{client.shortName}</span><span><strong>{client.name}</strong><small>Client workspace</small></span></div></section>
  {(problem||error)&&<div className="notice notice--warning" role="alert"><AlertTriangle size={17}/><p>{problem||error}</p></div>}
  <section className="config-upload-section"><div className="config-dropzone" onDragOver={e=>e.preventDefault()} onDrop={(e:DragEvent<HTMLDivElement>)=>{e.preventDefault();void files(e.dataTransfer.files)}}><UploadCloud size={32}/><h3>Upload previous accounting records</h3><p>CSV, XLSX, PDF, images, Markdown or text · 3 MB per file · up to 20 files</p><button className="button button--primary" disabled={working} onClick={()=>fileRef.current?.click()}>Choose files</button><input ref={fileRef} type="file" multiple accept=".csv,.xlsx,.pdf,.jpg,.jpeg,.png,.md,.txt" hidden onChange={e=>e.target.files&&void files(e.target.files)}/></div>
   {uploading.length>0&&<div className="config-upload-status">{uploading.map((f,i)=><div className={`config-upload-item config-upload-item--${f.status}`} key={`${f.name}-${i}`}><div className="config-upload-item__icon">{f.status==='analyzing'?<Loader2 size={16} className="spin"/>:f.status==='done'?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}</div><div className="config-upload-item__info"><strong>{f.name}</strong><span>{f.message||'Processing file…'}</span></div></div>)}</div>}
  </section>
 </div>
}
