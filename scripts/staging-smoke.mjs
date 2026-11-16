#!/usr/bin/env node
/** Non-destructive HTTP smoke tests for an already deployed STAGING environment. */
const base=(process.env.BOOKAI_STAGING_URL||'').replace(/\/$/,'')
if(!base){console.error('Set BOOKAI_STAGING_URL to the already-deployed staging URL.');process.exit(1)}
let origin
try{origin=new URL(base);if(!(origin.protocol==='https:'||(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))))throw Error('Use HTTPS except for localhost.');if(origin.pathname!=='/'||origin.search)throw Error('Provide the site origin only.')}catch(e){console.error('Invalid staging URL: '+e.message);process.exit(1)}
const failures=[]
async function check(path, expected){
  try{
    const response=await fetch(new URL(path,origin),{headers:{'Cache-Control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(12000)})
    if(!expected.includes(response.status)){failures.push(`${path}: HTTP ${response.status}, expected ${expected.join(' or ')}`);return null}
    console.log(`PASS  ${path}: HTTP ${response.status}`)
    return response
  }catch(e){failures.push(`${path}: ${e.message}`);return null}
}
const ver=await check('/version.json',[200])
if(ver){
  try{const data=await ver.json();if(data.release!=='bookai-step8-release-gates')failures.push('Version manifest is not the Step 8 build.');else console.log('PASS  Step 8 release marker.')}catch{failures.push('Version manifest is not valid JSON.')}
}
await check('/',[200])
await check('/api/bookkeeping',[401]) // No bearer token: must not disclose company books.
await check('/api/process',[405]) // GET must not cause AI processing.
await check('/api/ocr',[405]) // GET must not store an attachment.
await check('/api/generate-config',[405])
if(failures.length){for(const f of failures)console.error('FAIL  '+f);process.exitCode=1}
else console.log('PASS  Unauthenticated read blocked; no write requests made. Authenticated end-to-end QA is still required.')
