/** Spreadsheet-safe RFC4180 quoting for an adapter-neutral accounting export. */
export function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? '' : String(value)
  // Prevent spreadsheet clients interpreting untrusted vendor text as formulas.
  if (/^\s*[=+@\-\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text.trim())) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
