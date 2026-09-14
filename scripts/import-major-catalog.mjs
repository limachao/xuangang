import fs from 'node:fs'
import XLSX from 'xlsx'

const workbook = XLSX.readFile('教育部专科+本科+研究生专业目录汇总(1).xlsx', { cellDates: false })
const records = []

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const code = (value, length = 0) => {
  const text = clean(value).replace(/\.0$/, '')
  return length ? text.padStart(length, '0') : text
}
const add = (name, category, level, codes) => {
  if (!name || !codes.length) return
  records.push({ name, category, level, codes: [...new Set(codes.filter(Boolean))] })
}

const undergraduate = XLSX.utils.sheet_to_json(workbook.Sheets['本科'], { header: 1, defval: '' })
for (const row of undergraduate.slice(3)) {
  const category = clean(row[2])
  const majorCode = code(row[3], 6)
  const name = clean(row[4])
  if (name && majorCode) add(name, category, '本科', [`B${majorCode}`, `B${majorCode.slice(0, 4)}`])
}

const junior = XLSX.utils.sheet_to_json(workbook.Sheets['专科'], { header: 1, defval: '' })
for (const row of junior.slice(1)) {
  const majorCode = code(row[1], 6)
  const name = clean(row[2])
  if (name && majorCode) add(name, '', '专科', [`B${majorCode}`])
}

const academic = XLSX.utils.sheet_to_json(workbook.Sheets['研究生（学术学位）'], { header: 1, defval: '' })
for (const row of academic.slice(4)) {
  const category = clean(row[3])
  const firstCode = code(row[2], 4)
  const firstName = clean(row[3])
  const secondCode = code(row[4], 6)
  const secondName = clean(row[5])
  if (firstName && firstCode) add(firstName, '', '研究生', [`A${firstCode}`])
  if (secondName && secondCode) add(secondName, firstName, '研究生', [`A${secondCode}`, `A${secondCode.slice(0, 4)}`])
}

const professional = XLSX.utils.sheet_to_json(workbook.Sheets['研究生（专业学位）'], { header: 1, defval: '' })
for (const row of professional) {
  const text = clean(row[0])
  const match = text.match(/^(\d{4})\s*(.+?)(?:（.*）)?$/)
  if (match) add(match[2].trim(), '', '研究生', [`A${match[1]}`])
}

const merged = new Map()
for (const record of records) {
  const key = `${record.level}|${record.name}`
  const existing = merged.get(key)
  if (!existing) merged.set(key, record)
  else {
    existing.codes = [...new Set([...existing.codes, ...record.codes])]
    existing.category ||= record.category
  }
}

fs.mkdirSync('public/data', { recursive: true })
fs.writeFileSync('public/data/major-catalog.json', JSON.stringify([...merged.values()]))
console.log(`Imported ${merged.size} major records`)
