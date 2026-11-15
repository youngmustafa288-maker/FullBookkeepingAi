import common from '../../workflow/references/common.md?raw'
import { workflows } from './catalog'
import type { WorkflowId } from '../types'
const files=import.meta.glob('../../workflow/references/*.md',{query:'?raw',import:'default',eager:true}) as Record<string,string>
export interface ClientContextFiles { profile:string;vendors:string;glCodes:string;policies:string }
export function buildWorkflowContext(task:WorkflowId,client:ClientContextFiles){const id=task==='invoice'?'purchase-invoice':task==='receipt'?'expense-receipt':task;if(!workflows.some(w=>w.id===id))throw Error('Unsupported task');return [common,files[`../../workflow/references/${id}.md`],JSON.stringify(client)].join('\n\n')}
export function routeWorkflow(input:{task_type?:string;filename?:string;fields?:Record<string,unknown>}):WorkflowId|'unsupported_task'{if(input.task_type&&workflows.some(w=>w.id===input.task_type))return input.task_type as WorkflowId;return 'unsupported_task'}
