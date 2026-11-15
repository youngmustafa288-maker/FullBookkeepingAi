export const money = (value: number, absolute = false, currency = 'MYR') => new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency,
  minimumFractionDigits: 2,
}).format(absolute ? Math.abs(value) : value)

export const mytDate = (value: string, withTime = false) => Number.isNaN(Date.parse(value)) ? (value || 'Unspecified') : new Intl.DateTimeFormat('en-MY', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  timeZone: 'Asia/Kuala_Lumpur',
}).format(new Date(value))

export const relativeQueueAge = (value: string) => {
  const hours = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000))
  return hours >= 24 ? `${Math.floor(hours / 24)}d in queue` : `${hours}h in queue`
}

export const downloadCsv = <T extends object>(filename: string, rows: T[]) => {
  if (!rows.length) return
  const headers = Object.keys(rows[0]) as Array<keyof T>
  const escape = (value: unknown) => {const raw=String(value??'');const safe=/^[=+@\t\r]/.test(raw)||(/^-.+/.test(raw)&&!/^-[0-9]+(?:\.[0-9]+)?$/.test(raw))?"'"+raw:raw;return `"${safe.replace(/"/g,'""')}"`}
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
