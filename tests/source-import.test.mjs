import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import ExcelJS from 'exceljs'
await mkdir('node_modules/.cache/bookai',{recursive:true})
const outfile=resolve('node_modules/.cache/bookai/source-test.mjs')
await build({entryPoints:['server/source-text.ts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'})
const {sourceText}=await import(pathToFileURL(outfile).href)
test('configuration CSV import preserves the actual source and does not call OCR',async()=>{const text='code,name\n6100,"Office, stationery"\n';assert.equal(await sourceText(Buffer.from(text).toString('base64'),'text/csv','chart.csv'),text)})
test('configuration XLSX import reads workbook values instead of decoding binary as text',async()=>{const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('GL Codes');sheet.addRow(['Code','Name']);sheet.addRow(['6100','Office expenses']);const buffer=await book.xlsx.writeBuffer();const text=await sourceText(Buffer.from(buffer).toString('base64'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','chart.xlsx');assert.ok(text.includes('# Sheet: GL Codes'));assert.ok(text.includes('6100\tOffice expenses'))})
test('unsupported legacy spreadsheets and empty files give actionable errors',async()=>{await assert.rejects(()=>sourceText(Buffer.from('legacy').toString('base64'),'application/vnd.ms-excel','old.xls'),/Export legacy XLS/);await assert.rejects(()=>sourceText(Buffer.from(' ').toString('base64'),'text/plain','empty.txt'),/no readable text/)})
test('source import rejects oversized uploads before extraction',async()=>{await assert.rejects(()=>sourceText('A'.repeat(4_000_001),'text/plain','large.txt'),/below 3 MB/)})
