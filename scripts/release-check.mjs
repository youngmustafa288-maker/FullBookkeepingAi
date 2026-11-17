#!/usr/bin/env node
/** Offline-safe release preflight. This does NOT assert that UI or live systems work. */
import {readFileSync,existsSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const file=(path)=>join(root,path)
const json=(path)=>JSON.parse(readFileSync(file(path),'utf8'))
const strict=process.argv.includes('--deployment')
const failures=[];const warnings=[];const passed=[]
const pass=(msg)=>passed.push(msg)
const fail=(msg)=>failures.push(msg)
const warn=(msg)=>warnings.push(msg)
function ensure(condition,ok,notOk){condition?pass(ok):fail(notOk)}
function sha256(path){return createHash('sha256').update(readFileSync(file(path))).digest('hex')}

const required=['package.json','package-lock.json','index.html','vite.config.ts','vercel.json','src/styles.css','src/App.tsx','src/components/Shell.tsx','api/bookkeeping.ts','api/process.ts','api/ocr.ts','api/generate-config.ts','server/bookkeeping-auth.ts','server/bookkeeping-read.mjs','public/version.json']
ensure(required.every(path=>existsSync(file(path))),'Required build and deployment sources are present.','A required build or deployment source file is missing.')

try{
  const pkg=json('package.json');const lock=json('package-lock.json')
  const manifest=lock.packages?.['']
  ensure(pkg.name===manifest?.name && pkg.version===manifest?.version && JSON.stringify(pkg.dependencies)===JSON.stringify(manifest?.dependencies) && JSON.stringify(pkg.devDependencies)===JSON.stringify(manifest?.devDependencies), 'Package manifest and lockfile root dependencies match.', 'Package-lock root differs from package.json: regenerate and review the lockfile.')
  ensure(['test','build','check:server','verify:release'].every(s=>typeof pkg.scripts?.[s]==='string'),'Release commands are declared in package.json.','A required release command is missing from package.json.')
} catch(e){fail('Could not validate package manifest: '+e.message)}

try{
  const baseline=json('scripts/ui-baseline.json')
  ensure(Object.entries(baseline).every(([path,hash])=>sha256(path)===hash),'Original app shell, navigation, and global CSS match the Step 7 baseline.','Original UI shell/style changed relative to Step 7; perform design review before release.')
} catch(e){fail('Could not validate unchanged UI baseline: '+e.message)}

try{
  const v=json('vercel.json')
  const rewrites=v.rewrites||[]
  const apiIndex=rewrites.findIndex(item=>item.source==='/api/(.*)'&&item.destination==='/api/$1')
  const spaIndex=rewrites.findIndex(item=>item.source==='/(.*)'&&item.destination==='/index.html')
  ensure(apiIndex>=0&&spaIndex>apiIndex,'API routing precedes SPA fallback.','Vercel API rewrite is missing or comes after SPA fallback.')
  ensure(['api/bookkeeping.ts','api/process.ts','api/ocr.ts','api/generate-config.ts'].every(path=>v.functions?.[path]),'Expected API function configuration is present.','An API function declaration is missing in vercel.json.')
} catch(e){fail('Could not validate Vercel routing: '+e.message)}

try{
  const migrations=readdirSync(file('supabase/migrations')).filter(name=>name.endsWith('.sql'))
  const requiredNumbers=['001','002','003','004','005','006']
  ensure(requiredNumbers.every(number=>migrations.some(name=>name.startsWith('202610110'+number+'_'))),'All six ordered database migration files are present.','One or more of the six original database migrations are missing.')
} catch(e){fail('Could not check migration inventory: '+e.message)}

try{
  const gitignore=readFileSync(file('.gitignore'),'utf8').split(/\r?\n/)
  ensure(['.env','node_modules','dist'].every(item=>gitignore.includes(item)),'Local secrets, dependencies, and build output are ignored.','Review .gitignore: secrets, node_modules, or dist may be accidentally included.')
  if(['.env','.env.local','.env.production','.env.production.local'].some(name=>existsSync(file(name))))warn('A local .env file exists: exclude it from source archives and deployment uploads.')
  const example=readFileSync(file('.env.example'),'utf8')
  ensure(example.includes('VITE_BOOKKEEPING_MODE=cloud'),'The documented browser default is cloud mode.','The env template does not default to cloud mode.')
} catch(e){fail('Could not check environment examples and ignore rules: '+e.message)}

try{
  const meta=json('public/version.json')
  ensure(meta.workflow_menu_count===5&&meta.five_document_workflows===true&&meta.e_invoicing===false,'Release manifest retains five document workflows and excludes e-Invoicing.','The release manifest conflicts with the approved workflow menu.')
  ensure(meta.deployment_status==='source_only_not_deployed','Release manifest does not falsely claim live deployment.','The release manifest must not assert a deployment that has not happened.')
} catch(e){fail('Could not check release manifest: '+e.message)}

const mode=process.env.VITE_BOOKKEEPING_MODE
if(mode && !['cloud','local'].includes(mode))fail('VITE_BOOKKEEPING_MODE must be cloud or local.')
for(const key of Object.keys(process.env)){
  if(/^VITE_.*(?:SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|OPENROUTER|GEMINI_API_KEY)/i.test(key) && process.env[key])fail(`Do not expose a private credential using ${key} in a public Vite build.`)
}
if(strict){
  if(mode!=='cloud')fail('Deployment check requires VITE_BOOKKEEPING_MODE=cloud; local mode is demonstration-only.')
  for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPENROUTER_API_KEY']){
    const value=process.env[key]||''
    if(!value||/^(placeholder|your-|change-me)/i.test(value))fail(`Deployment requires a configured ${key} (value not printed).`)
  }
  const url=process.env.VITE_SUPABASE_URL||''
  if(url && !/^https:\/\//.test(url))fail('A deployment requires an HTTPS Supabase URL.')
} else {
  warn('Production environment variables, real authentication, private evidence access, AI service, and Supabase migrations are NOT verified offline.')
  warn('Run npm ci, npm test, npm run build, and npm run check:server in CI with complete dependencies.')
}

for(const msg of passed)console.log('PASS  '+msg)
for(const msg of warnings)console.log('WARN  '+msg)
for(const msg of failures)console.error('FAIL  '+msg)
console.log(`Release preflight: ${passed.length} passed, ${warnings.length} warnings, ${failures.length} failed.`)
if(failures.length)process.exitCode=1
