import {supabase} from '../lib/supabase'
export async function openEvidence(reference:string){
 const prefix='evidence://bookkeeping-evidence/';if(!reference.startsWith(prefix))throw Error('This source is a manual evidence reference. Open it in the original source system.')
 const {data,error}=await supabase.storage.from('bookkeeping-evidence').createSignedUrl(reference.slice(prefix.length),60)
 if(error||!data)throw Error('Could not open this attachment.')
 window.open(data.signedUrl,'_blank','noopener,noreferrer')
}
