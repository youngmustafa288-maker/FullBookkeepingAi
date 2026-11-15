import type {VercelRequest,VercelResponse} from '@vercel/node'
import {runDocumentOcr} from '../server/ocr'
import {authorise} from '../server/bookkeeping-auth'
export default async function handler(req:VercelRequest,res:VercelResponse){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'})
 try{
  const {imageBase64,mimeType,companyId,filename}=req.body||{}
  if(typeof imageBase64!=='string'||imageBase64.length>4_000_000||!['image/jpeg','image/png','application/pdf'].includes(mimeType)||typeof companyId!=='string')return res.status(400).json({error:'Select a company and a JPG, PNG or PDF below 3 MB.'})
  const {userDb}=await authorise(req,companyId)
  const source=`${companyId}/${crypto.randomUUID()}/${String(filename||'document').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)}`
  const {error}=await userDb.storage.from('bookkeeping-evidence').upload(source,Buffer.from(imageBase64,'base64'),{contentType:mimeType,upsert:false});if(error)return res.status(503).json({error:'Could not preserve the original attachment. Check the private evidence bucket and policies.'})
  const output=await runDocumentOcr(imageBase64,mimeType)
  return res.json({data:{rawText:output.text},evidence:`evidence://bookkeeping-evidence/${source}`,model:output.model})
 }catch(e){const err=e as Error&{status?:number};return res.status(err.status||502).json({error:'Document extraction failed. Check authentication and the configured OCR provider.'})}
}
