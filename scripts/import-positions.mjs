import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const workbook = XLSX.readFile('2026军队文职岗位表王老师.xlsx', { cellDates: false })
const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1, { header: 1, defval: '' }).slice(3)

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function getGender(otherConditions) {
  const conditions = otherConditions.split(/[;；,，]/).map((item) => item.trim())
  const hasMale = conditions.some((condition) => /^(男|男性)$/.test(condition))
  const hasFemale = conditions.some((condition) => /^(女|女性)$/.test(condition))
  if (hasMale && !hasFemale) return '男'
  if (hasFemale && !hasMale) return '女'
  return '不限'
}

function getAdditionalConditions(otherConditions) {
  return otherConditions.split(/[;；,，]/).filter((item) => !/^(男|男性|女|女性)$/.test(item.trim())).join(';')
}

function getEducationLevel(education) {
  if (education.includes('博士')) return 4
  if (education.includes('研究生') || education.includes('硕士')) return 3
  if (education.includes('本科')) return 2
  if (education.includes('大专')) return 1
  return 0
}

function getMajorNames(majorText) {
  return majorText
    .split(/[,，\n]/)
    .map((item) => item.replace(/^[A-Z]\d+/, '').replace(/（专业学位）$/, '').trim())
    .filter(Boolean)
}

function getMasterTypes(majorText) {
  if (!majorText.includes('研究生:')) return []
  const majorEntries = majorText.split(/[,，\n]/).filter(Boolean)
  return [...new Set(majorEntries.map((item) => item.includes('（专业学位）') ? '专业型硕士' : '学术型硕士'))]
}

const positions = rows
  .filter((row) => row[0] !== '')
  .map((row, index) => {
    const otherConditions = clean(row[17])
    const education = clean(row[9])
    const majorText = clean(row[11])
    const source = clean(row[8])
    return {
      id: Number(row[0]) || index + 1,
      unitNumber: clean(row[1]),
      unit: clean(row[2]),
      category: clean(row[3]),
      role: clean(row[4]),
      work: clean(row[5]),
      recruitmentCount: Number(row[6]) || 0,
      source,
      education,
      educationLevel: getEducationLevel(education),
      degree: clean(row[10]),
      majorText,
      majorNames: getMajorNames(majorText),
      masterTypes: getMasterTypes(majorText),
      examSubject: clean(row[12]),
      professionalTitle: clean(row[13]) + (clean(row[14]) ? ` / ${clean(row[14])}` : ''),
      qualification: clean(row[15]) + (clean(row[16]) ? ` / ${clean(row[16])}` : ''),
      otherConditions,
      additionalConditions: getAdditionalConditions(otherConditions),
      gender: getGender(otherConditions),
      city: clean(row[18]),
      phone: clean(row[19]),
      score: Number(row[20]) || 0,
      positionType: clean(row[21]),
    }
  })

fs.mkdirSync('public/data', { recursive: true })
fs.writeFileSync(path.join('public/data/positions.json'), JSON.stringify(positions))
console.log(`Imported ${positions.length} positions`)
