import fs from 'node:fs'
import XLSX from 'xlsx'
import { PDFParse } from 'pdf-parse'

const catalogFile = '教育部专科+本科+研究生专业目录汇总(1).xlsx'
const pdfFiles = ['普通高等学校本科专业目录（2025年）.pdf', '普通高等学校本科专业目录（2026年）.pdf']
const records = []
const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const code = (value, length = 0) => {
  const text = clean(value).replace(/\.0$/, '')
  return length ? text.padStart(length, '0') : text
}
const add = (name, category, level, codes, masterTypes = []) => {
  if (!name || !codes.length) return
  const normalizedCodes = [...new Set(codes.filter(Boolean))]
  records.push({
    name,
    category,
    level,
    codes: normalizedCodes,
    masterTypes,
    masterTypeByCode: Object.fromEntries(normalizedCodes.map((majorCode) => [majorCode, masterTypes])),
  })
}

const hierarchyCodes = (prefix, majorCode) => {
  const codeValue = majorCode.replace(/^[AB]/, '')
  return [`${prefix}${codeValue}`, `${prefix}${codeValue.slice(0, 4)}`, `${prefix}${codeValue.slice(0, 2)}`]
}

const workbook = XLSX.readFile(catalogFile, { cellDates: false })
const junior = XLSX.utils.sheet_to_json(workbook.Sheets['专科'], { header: 1, defval: '' })
for (const row of junior.slice(1)) {
  const majorCode = code(row[1], 6)
  if (clean(row[2]) && majorCode) add(clean(row[2]), '', '专科', hierarchyCodes('B', majorCode))
}

const academic = XLSX.utils.sheet_to_json(workbook.Sheets['研究生（学术学位）'], { header: 1, defval: '' })
for (const row of academic.slice(4)) {
  const firstCode = code(row[2], 4)
  const firstName = clean(row[3])
  const secondCode = code(row[4], 6)
  const secondName = clean(row[5])
  if (firstName && firstCode) add(firstName, '', '研究生', hierarchyCodes('A', firstCode), ['学术型硕士'])
  if (secondName && secondCode) add(secondName, firstName, '研究生', hierarchyCodes('A', secondCode), ['学术型硕士'])
}

const professional = XLSX.utils.sheet_to_json(workbook.Sheets['研究生（专业学位）'], { header: 1, defval: '' })
for (const row of professional) {
  const match = clean(row[0]).match(/^(\d{4,6})\s*(.+)$/)
  if (match) add(match[2].replace(/（专业学位）$/, '').trim(), '', '研究生', hierarchyCodes('A', match[1]), ['专业型硕士'])
}

for (const pdfFile of pdfFiles) {
  const pdf = new PDFParse({ data: fs.readFileSync(pdfFile) })
  const text = (await pdf.getText()).text
  await pdf.destroy()
  let currentCategory = ''
  for (const rawLine of text.split(/\n/)) {
    const line = clean(rawLine)
    const categoryMatch = line.match(/^(\d{4})\s+(.+类)$/)
    const majorMatch = line.match(/^(\d{6}[TK]*)\s+(.+?)(?:（注：.*）)?$/)
    if (categoryMatch) {
      currentCategory = categoryMatch[2]
    } else if (majorMatch) {
      const majorCode = majorMatch[1]
      add(majorMatch[2].trim(), currentCategory, '本科', hierarchyCodes('B', majorCode))
    }
  }
}

const merged = new Map()
for (const record of records) {
  const key = `${record.level}|${record.name}`
  const existing = merged.get(key)
  if (!existing) merged.set(key, record)
  else {
    existing.codes = [...new Set([...existing.codes, ...record.codes])]
    existing.masterTypes = [...new Set([...existing.masterTypes, ...record.masterTypes])]
    for (const [majorCode, masterTypes] of Object.entries(record.masterTypeByCode)) {
      existing.masterTypeByCode[majorCode] = [...new Set([...(existing.masterTypeByCode[majorCode] ?? []), ...masterTypes])]
    }
    existing.category ||= record.category
  }
}

fs.mkdirSync('public/data', { recursive: true })
fs.writeFileSync('public/data/major-catalog.json', JSON.stringify([...merged.values()]))
console.log(`Imported ${merged.size} records with 2025 and 2026 undergraduate catalogs`)
