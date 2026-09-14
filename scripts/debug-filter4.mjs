import positions from '../public/data/positions.json' with { type: 'json' }
import catalog from '../public/data/major-catalog.json' with { type: 'json' }

function normalizeMajorCode(value) {
  return value.replace(/[TK]+$/i, '')
}

function getMajorCodes(major, education) {
  const levels = education === '大专' ? ['专科'] : education === '本科' ? ['本科'] : ['研究生']
  return catalog.filter(r => levels.includes(r.level) && r.name === major.trim()).flatMap(r => r.codes)
}

function normalizeText(value) {
  return value
    .replace(/[“”"'']/g, '')
    .replace(/[（）()]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function parseConditions(raw) {
  const parts = raw.split(/[;；]/).map(s => s.trim()).filter(Boolean)
  const political = []
  const school = []
  const special = []
  let majorMatch = false
  const certs = []
  const skills = []

  for (const part of parts) {
    const normalized = normalizeText(part)
    if (/中共党员|中共正式党员|党员/.test(normalized)) political.push('中共党员')
    else if (/中共预备党员|预备党员/.test(normalized)) political.push('中共预备党员')
    else if (/985/.test(normalized)) school.push('985')
    else if (/211/.test(normalized)) school.push('211')
    else if (/双一流|一流大学|一流学科|一流高校/.test(normalized)) school.push('双一流')
    else if (/专业.{0,4}(与|和|同)?岗位要求一致|专业一致/.test(normalized)) majorMatch = true
    else if (/烈士|军烈属|因公牺牲|病故军人/.test(normalized)) special.push('烈士亲属')
    else if (/服役|退伍|退役军人|军龄/.test(normalized)) special.push('服役经历')
    else if (/证书|资格|执业|职称|等级|专业八级|cet|雅思|托福|计算机等级|普通话/.test(normalized)) certs.push(part)
    else if (normalized.length > 0) skills.push(part)
  }

  return {
    political: political.length > 0 ? political : ['不限'],
    school: school.length > 0 ? school : ['不限'],
    majorMatch,
    special: special.length > 0 ? special : ['不限'],
    certs,
    skills,
    raw,
  }
}

function politicalMatches(client, position) {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  if (client === '中共党员') return position.includes('中共党员') || position.includes('中共预备党员')
  if (client === '中共预备党员') return position.includes('中共预备党员')
  return false
}

function schoolMatches(client, position) {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  const hierarchy = ['双一流', '211', '985']
  const idx = hierarchy.indexOf(client)
  if (idx === -1) return false
  for (let i = idx; i < hierarchy.length; i++) {
    if (position.includes(hierarchy[i])) return true
  }
  return false
}

function specialMatches(client, position) {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  return position.includes(client)
}

const client = {
  gender: '男',
  education: '本科',
  major: '财务管理',
  status: '应届生',
  city: '河北',
  politicalStatus: '中共党员',
  schoolLevel: '211',
  majorMatchMode: '不限',
  certificates: '',
  specialExperience: '不限',
  specialExperienceNote: '',
}

const majorCodes = getMajorCodes(client.major, client.education)
console.log('匹配专业代码:', majorCodes)

const filtered = positions.filter(p => {
  const genderMatches = p.gender === '男' || p.gender === '不限'
  const educationMatches = 2 >= p.educationLevel
  const positionCodes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  const majorMatches = majorCodes.some(code => positionCodes.some(pc => normalizeMajorCode(pc) === normalizeMajorCode(code)))
  const graduateMatches = p.source.includes('高校毕业生')
  const cityMatches = !client.city || p.city.includes(client.city)

  const parsed = parseConditions(p.additionalConditions || p.otherConditions || '')
  const political = politicalMatches(client.politicalStatus, parsed.political)
  const school = schoolMatches(client.schoolLevel, parsed.school)
  const majorMatch = client.majorMatchMode === '必须一致' ? parsed.majorMatch : true
  const special = specialMatches(client.specialExperience, parsed.special)
  const certMatch = parsed.certs.length === 0 || false
  const skillsMatch = parsed.skills.length === 0 || false

  return genderMatches && educationMatches && majorMatches && graduateMatches && cityMatches && political && school && majorMatch && special && certMatch && skillsMatch
})

console.log('系统筛选结果数量:', filtered.length)
console.log('\n结果岗位：')
filtered.forEach(p => {
  console.log(p.unitNumber, p.unit.slice(0, 20), p.city, p.education, p.source, p.additionalConditions || '(空)')
})

// 再看看河北地区财务管理相关专业，但可能被其他条件卡掉的
console.log('\n\n河北地区、男、本科、高校毕业生、专业匹配，不考虑其他条件的岗位：')
const baseMatched = positions.filter(p => {
  const genderMatches = p.gender === '男' || p.gender === '不限'
  const educationMatches = 2 >= p.educationLevel
  const positionCodes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  const majorMatches = majorCodes.some(code => positionCodes.some(pc => normalizeMajorCode(pc) === normalizeMajorCode(code)))
  const graduateMatches = p.source.includes('高校毕业生')
  const cityMatches = p.city.includes('河北')
  return genderMatches && educationMatches && majorMatches && graduateMatches && cityMatches
})
console.log('数量:', baseMatched.length)
baseMatched.forEach(p => {
  const parsed = parseConditions(p.additionalConditions || p.otherConditions || '')
  console.log(p.unitNumber, p.city, p.additionalConditions || '(空)', '| 政治:', parsed.political.join(','), '| 院校:', parsed.school.join(','), '| 技能:', parsed.skills.join(';').slice(0, 60))
})
