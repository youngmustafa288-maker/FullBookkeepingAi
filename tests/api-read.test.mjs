import {test} from 'node:test'
import assert from 'node:assert/strict'
import {requireSuccessfulRead,requireWorkspaceState} from '../server/bookkeeping-read.mjs'

test('a successful empty company query is a valid no-company result',()=>{
  assert.deepEqual(requireSuccessfulRead({data:[],error:null},'company list'),[])
})
test('a failed company query is never replaced by an empty client list',()=>{
  assert.throws(()=>requireSuccessfulRead({data:null,error:{message:'query timed out'}},'company list'),error=>error.status===503&&/company list/.test(error.message))
})
test('a failed workspace query cannot masquerade as fresh blank books',()=>{
  assert.throws(()=>requireSuccessfulRead({data:null,error:{code:'42501'}},'company workspaces'),error=>error.status===503&&/bookkeeping records were not changed/.test(error.message))
})
test('unexpected database payloads fail closed',()=>{
  assert.throws(()=>requireSuccessfulRead({data:{revision:0},error:null},'company workspaces'),/Invalid company workspaces response/)
  assert.throws(()=>requireSuccessfulRead(null,'company workspaces'),/Could not load company workspaces/)
})

const emptyState=()=>({version:1,revision:0,audit:[],documents:[],cases:[],allocations:[],contexts:{}})
test('a truly missing company workspace initializes a fresh empty state',()=>{
  assert.deepEqual(requireWorkspaceState(null,emptyState),emptyState())
  assert.deepEqual(requireWorkspaceState(undefined,emptyState),emptyState())
})
test('valid saved workspace is returned without rewriting customer data',()=>{
  const state={...emptyState(),revision:12,documents:[{id:'existing-receipt'}]}
  assert.strictEqual(requireWorkspaceState({state},emptyState),state)
})
test('null and incompatible saved workspace cannot appear as empty books',()=>{
  for(const row of [{state:null},{state:{}},{state:{...emptyState(),version:99}},{state:{...emptyState(),revision:-1}}]){
    assert.throws(()=>requireWorkspaceState(row,emptyState),error=>error.status===503&&/records were not changed/.test(error.message))
  }
})
test('malformed audit or operational arrays cannot be silently lost',()=>{
  assert.throws(()=>requireWorkspaceState({state:{...emptyState(),audit:null}},emptyState),error=>error.status===503)
  assert.throws(()=>requireWorkspaceState({state:{...emptyState(),documents:'bad data'}},emptyState),error=>error.status===503)
})
