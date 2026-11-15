import type {VercelRequest,VercelResponse} from '@vercel/node'
export default function handler(_req:VercelRequest,res:VercelResponse){return res.status(410).json({error:'Use Client configuration to import and save reviewed company context.'})}
