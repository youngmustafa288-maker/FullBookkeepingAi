import type {Client,CloseSchedule} from '../types'

export const defaultCloseSchedule:CloseSchedule={
 financialYearEnd:'31 December',
 firstPeriod:'2026-11',
 bookCloseDay:10,
 cutOffRule:'Include documents dated through the final calendar day',
 reminderTiming:'7 days before, 3 days before and on close day',
 lateEntryRule:'Hold for the next open period unless reopening is approved'
}

export function closeScheduleFor(client:Client,workspaceSchedule?:CloseSchedule|null){return workspaceSchedule||client.closeSchedule||defaultCloseSchedule}

const monthAfter=(period:string)=>{const [year,month]=period.split('-').map(Number),date=new Date(Date.UTC(year,month,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`}
const malaysiaDate=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)

export function closeWindow(schedule:CloseSchedule,closedThrough:string|null,today=new Date()){
 const period=closedThrough?monthAfter(closedThrough.slice(0,7)):schedule.firstPeriod
 const [year,month]=period.split('-').map(Number)
 const closeMonth=new Date(Date.UTC(year,month,1))
 const closeDate=`${closeMonth.getUTCFullYear()}-${String(closeMonth.getUTCMonth()+1).padStart(2,'0')}-${String(schedule.bookCloseDay).padStart(2,'0')}`
 const current=malaysiaDate(today)
 const daysLeft=Math.ceil((Date.parse(`${closeDate}T00:00:00Z`)-Date.parse(`${current}T00:00:00Z`))/86_400_000)
 const periodLabel=new Intl.DateTimeFormat('en-MY',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1)))
 const closeLabel=new Intl.DateTimeFormat('en-MY',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${closeDate}T00:00:00Z`))
 return{period,periodLabel,closeDate,closeLabel,daysLeft}
}
