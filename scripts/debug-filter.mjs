import catalog from '../public/data/major-catalog.json' with { type: 'json' }
import positions from '../public/data/positions.json' with { type: 'json' }

function normalizeCondition(value) {
  return value.replace(/[“”"'（）()\s]/g, '').replace(/正式/g, '').replace(/具有/g, '')
}
function conditionsMatch(required, provided) {
  if (!required) return true
  if (!provided.trim()) return false
  const providedText = normalizeCondition(provided)
  return required.split(/[;；,，]/).every((condition) => condition.split(/或者|或/).some((alternative) => {
    const normalized = normalizeCondition(alternative)
    return normalized && providedText.includes(normalized)
  }))
}
function getMajorCodes(major, education) {
  const levels = education === '大专' ? ['专科'] : education === '本科' ? ['本科'] : ['研究生']
  return catalog.filter(r => levels.includes(r.level) && r.name === major.trim()).flatMap(r => r.codes)
}
function normalizeMajorCode(value) {
  return value.replace(/[TK]+$/i, '')
}

const client = { gender: '男', education: '本科', major: '计算机科学与技术', status: '应届生', city: '', otherLimitations: '' }
const majorCodes = getMajorCodes(client.major, client.education)
console.log('匹配专业代码:', majorCodes)

const withoutLimit = positions.filter(p => {
  const genderMatches = p.gender === '男' || p.gender === '不限'
  const educationMatches = 2 >= p.educationLevel
  const positionCodes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  const majorMatches = majorCodes.some(code => positionCodes.some(pc => normalizeMajorCode(pc) === normalizeMajorCode(code)))
  const graduateMatches = p.source.includes('高校毕业生')
  return genderMatches && educationMatches && majorMatches && graduateMatches
})
console.log('不考虑岗位限制条件:', withoutLimit.length)

const withLimit = positions.filter(p => {
  const genderMatches = p.gender === '男' || p.gender === '不限'
  const educationMatches = 2 >= p.educationLevel
  const positionCodes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  const majorMatches = majorCodes.some(code => positionCodes.some(pc => normalizeMajorCode(pc) === normalizeMajorCode(code)))
  const graduateMatches = p.source.includes('高校毕业生')
  const limitationMatches = conditionsMatch(p.additionalConditions, client.otherLimitations)
  return genderMatches && educationMatches && majorMatches && graduateMatches && limitationMatches
})
console.log('考虑岗位限制条件（不填=不满足）:', withLimit.length)
console.log('因 additionalConditions 被过滤掉:', withoutLimit.length - withLimit.length)

// 分析 withoutLimit 中重复或奇怪的项
const byCode = {}
withoutLimit.forEach(p => {
  const codes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  codes.forEach(c => {
    const nc = normalizeMajorCode(c)
    if (majorCodes.includes(nc)) {
      byCode[nc] = (byCode[nc] || 0) + 1
    }
  })
})
console.log('按匹配到的专业代码统计:', byCode)
