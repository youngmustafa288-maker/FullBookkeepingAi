import {supabase} from './supabase'
async function post(path:string,body:unknown){const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Sign in to a cloud company before using document extraction.');const res=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});const result=await res.json();if(!res.ok)throw Error(result.error||'Request failed');return result}
export const runOCR=(imageBase64:string,mimeType:string,companyId:string,filename:string)=>post('ocr',{imageBase64,mimeType,companyId,filename})
export const processDocument=(params:{task:string;companyId:string;ocrData:unknown})=>post('process',params)
export function fileToBase64(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)})}
