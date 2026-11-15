import {createClient} from '@supabase/supabase-js'
import type {VercelRequest} from '@vercel/node'
export async function authorise(req:VercelRequest,companyId?:string){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY
 if(!url||!key)throw Object.assign(Error('Configure the server Supabase URL and anon key.'),{status:503})
 const token=String(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)throw Object.assign(Error('Authentication required.'),{status:401})
 const userDb=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}})
 const {data:{user},error}=await userDb.auth.getUser(token);if(error||!user)throw Object.assign(Error('Your session has expired.'),{status:401})
 if(companyId){const {data,error}=await userDb.from('company_users').select('company_id').eq('user_id',user.id).eq('company_id',companyId).maybeSingle();if(error||!data)throw Object.assign(Error('Company access denied.'),{status:403})}
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
 const admin=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false}}):null
 return {user,userDb,admin}
}
