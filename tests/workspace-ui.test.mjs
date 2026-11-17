import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {Simulate} from 'react-dom/test-utils'

test('workspace: upload → AI proposal → review corrections → reports/audit, and upload-only client configuration',async()=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost'})
 for(const name of ['window','document','HTMLElement','HTMLInputElement','FileReader','File','Blob','Event','MouseEvent','localStorage'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true,writable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){}
 await mkdir('node_modules/.cache/bookai',{recursive:true})
 const outfile=resolve('node_modules/.cache/bookai/ui-test.mjs')
 await build({stdin:{contents:"export {default as App} from './src/App';export {AuthProvider} from './src/context/AuthContext';export {supabase} from './src/lib/supabase'",resolveDir:process.cwd(),loader:'tsx'},outfile,bundle:true,jsx:'automatic',platform:'node',format:'esm',packages:'external',define:{'import.meta.env':JSON.stringify({VITE_BOOKKEEPING_MODE:'local'})},logLevel:'silent'})
 const {App,AuthProvider,supabase}=await import(pathToFileURL(outfile).href+'?test='+Date.now())
 supabase.auth.getSession=async()=>({data:{session:{access_token:'test-token',user:{id:'test-user',email:'reviewer@example.test'}}},error:null})
 supabase.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}})
 const originalFetch=globalThis.fetch;const calls=[]
 globalThis.fetch=async(url,options)=>{calls.push(String(url));const body=JSON.parse(options.body);if(String(url).endsWith('/api/ocr'))return Response.json({data:{reference:'P100',total:1000},evidence:'Test invoice source',filename:'invoice.pdf',mimeType:'application/pdf'});if(String(url).endsWith('/api/process'))return Response.json({model_used:'test-model',confidence:.95,result:{message:'Prepared a supplier invoice for review.',confidence:.95,extracted_fields:{reference:'P100',party:'Supplier',amount:'1000.00',date:'2026-11-01',currency:'MYR'},warnings:[],missing_evidence:[],blocked:false,actions:[{type:'document',payload:{kind:'purchase-invoice',reference:'P100',party:'Supplier',amount:'1000.00',date:'2026-11-01',currency:'MYR'}}]}});if(String(url).endsWith('/api/generate-config'))return Response.json({message:'Here is the supported chart draft.',markdown:'# Chart of accounts\n- 6100: Office expenses',configs:{glCodes:'# Chart of accounts\n- 6100: Office expenses'},questions:[],saved:false});throw Error('Unexpected network request: '+url)}
 const root=createRoot(document.getElementById('root'));const flush=()=>act(async()=>{await new Promise(r=>setTimeout(r,40))})
 const button=text=>{const found=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(found,'Button missing: '+text);return found}
 const click=async b=>{await act(async()=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));await flush()}
 try{
  await act(async()=>root.render(React.createElement(AuthProvider,null,React.createElement(App))));await flush()
  await click(button('Workflow workspace'))
  assert.equal(document.querySelectorAll('.workflow-list>button').length,5)
  assert.ok(document.querySelector('.drop-zone'));assert.ok(document.querySelector('.composer input'));assert.ok(document.querySelector('.session-panel'))
  assert.ok(!document.body.textContent.includes('Stage a document'));assert.ok(!document.body.textContent.includes('SST & e-Invoice admin'))
  const input=document.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[new File(['invoice text'],'invoice.pdf',{type:'application/pdf'})],configurable:true})
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));for(let i=0;i<5;i++)await flush()
  assert.ok(document.querySelector('.inline-review'),'Upload result must become a real pending proposal')
  let state=JSON.parse(localStorage.getItem('bookai-v2:suria'));assert.equal(state.documents.length,0);assert.equal(state.cases.length,1)
  await click(button('Review queue1'))
  await click(button('Review'))
  assert.ok(document.querySelector('[role=dialog]'));assert.ok(document.querySelector('.attachment-pane'));assert.ok(document.querySelector('.proposal-pane'))
  const reference=document.querySelector('input[aria-label=reference]');await act(async()=>Simulate.change(reference,{target:{value:'P100-CORRECTED'}}))
  await click([...document.querySelector('[role=dialog]').querySelectorAll('button')].find(b=>b.textContent.trim()==='Approve'))
  state=JSON.parse(localStorage.getItem('bookai-v2:suria'));assert.equal(state.documents.length,1);assert.equal(state.documents[0].reference,'P100-CORRECTED');assert.equal(state.documents[0].status,'approved');assert.equal(state.cases[0].status,'approved')
  await click(button('Reports'));assert.equal(document.querySelectorAll('.report-tabs>button').length,5);assert.ok(document.body.textContent.includes('General Ledger'));assert.ok(document.body.textContent.includes('Management Summary'))
  await click(button('Audit log'));assert.ok(document.querySelector('.audit-table'));assert.ok(document.body.textContent.includes('approve-case'))
  await click(button('Client configuration'));assert.ok(document.querySelector('.config-dropzone'));assert.equal([...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Configure with AI')).length,0);assert.equal(document.querySelector('.config-extracted'),null)
  const configInput=document.querySelector('.config-dropzone input[type=file]');Object.defineProperty(configInput,'files',{value:[new File(['chart'],'chart.pdf',{type:'application/pdf'})],configurable:true})
  await act(async()=>configInput.dispatchEvent(new Event('change',{bubbles:true})));for(let i=0;i<5;i++)await flush()
  state=JSON.parse(localStorage.getItem('bookai-v2:suria'));assert.ok(state.contexts.glCodes.includes('6100'));assert.ok(calls.includes('/api/generate-config'));assert.ok(calls.includes('/api/process'))
 }finally{await act(async()=>root.unmount());await supabase.auth.dispose();globalThis.fetch=originalFetch;dom.window.close();globalThis.IS_REACT_ACT_ENVIRONMENT=false}
})
