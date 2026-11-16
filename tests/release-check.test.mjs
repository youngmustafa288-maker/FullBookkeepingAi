import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolve,dirname} from 'node:path'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const run=(args,env)=>spawnSync(process.execPath,['scripts/release-check.mjs',...args],{cwd:root,encoding:'utf8',env:{...process.env,...env}})
test('offline release checks pass without any production secrets',()=>{
  const result=run([],{VITE_BOOKKEEPING_MODE:'cloud'})
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr)
  assert.match(result.stdout,/0 failed/)
  assert.match(result.stdout,/Original app shell/)
})
test('production check refuses demo mode and missing private credentials',()=>{
  const keys=['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENROUTER_API_KEY']
  const scrubbed=Object.fromEntries(keys.map(key=>[key,'']))
  const result=run(['--deployment'],{...scrubbed,VITE_BOOKKEEPING_MODE:'local'})
  assert.notEqual(result.status,0,'An invalid production configuration must never be release-ready')
  assert.match(result.stderr,/cloud/)
  assert.match(result.stderr,/SUPABASE_SERVICE_ROLE_KEY/)
  assert.ok(!result.stderr.includes('sk-test-secret'))
})
