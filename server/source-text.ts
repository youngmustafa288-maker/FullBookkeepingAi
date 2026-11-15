import ExcelJS from 'exceljs'
import {runDocumentOcr} from './ocr'
function guardXlsx(buffer:Buffer){
 let total=0,files=0
 for(let i=0;i+46<buffer.length;i++)if(buffer.readUInt32LE(i)===0x02014b50){total+=buffer.readUInt32LE(i+24);files++;if(total>25_000_000||files>3000)throw Error('Workbook is too large after extraction. Export the relevant sheets as CSV.');i+=45+buffer.readUInt16LE(i+28)+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32)}
 if(!files)throw Error('This is not a supported XLSX workbook.')
}
export async function sourceText(base64:string,mimeType:string,filename:string){
 if(typeof base64!=='string'||base64.length>4_000_000)throw Error('Choose a source file below 3 MB.')
 const ext=filename.toLowerCase().split('.').pop(),buffer=Buffer.from(base64,'base64')
 if(buffer.length>3_000_000)throw Error('Choose a source file below 3 MB.')
 let text=''
 if(['csv','txt','md','json'].includes(ext||''))text=buffer.toString('utf8')
 else if(ext==='xlsx'){
  guardXlsx(buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);let cells=0
  const lines:string[]=[]
  for(const sheet of workbook.worksheets){lines.push(`# Sheet: ${sheet.name}`);sheet.eachRow(row=>{const values:string[]=[];row.eachCell({includeEmpty:true},cell=>{if(++cells>30000)throw Error('Workbook contains too many cells. Export the relevant rows as CSV.');values.push(cell.text.replace(/[\t\r\n]/g,' '))});lines.push(values.join('\t'))})}text=lines.join('\n')
 }else if(['pdf','png','jpg','jpeg','webp'].includes(ext||'')){const resolved=ext==='pdf'?'application/pdf':mimeType||`image/${ext==='jpg'?'jpeg':ext}`;text=(await runDocumentOcr(base64,resolved)).text}
 else throw Error('Use CSV, XLSX, PDF, JPG, PNG, Markdown or text. Export legacy XLS as XLSX or CSV.')
 if(!text.trim())throw Error('The source contains no readable text.')
 if(text.length>180000)throw Error('Source text is too large. Split the source into smaller files without omitting control totals.')
 return text
}
