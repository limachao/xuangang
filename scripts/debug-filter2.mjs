import catalog from '../public/data/major-catalog.json' with { type: 'json' }
import positions from '../public/data/positions.json' with { type: 'json' }

console.log('目录中包含 B08 代码的记录：')
catalog.filter(r => r.codes.some(c => c === 'B08' || c.startsWith('B08'))).forEach(r => {
  console.log(r.level, r.name, r.codes)
})

console.log('\n岗位表 majorText 中 B08 的分布情况：')
let onlyB08 = 0, b08AndOthers = 0
positions.forEach(p => {
  const codes = p.majorText.match(/\bB\d{2,6}[TK]*\b/g) ?? []
  const hasB08 = codes.some(c => c === 'B08')
  const hasB0809 = codes.some(c => c === 'B0809')
  const hasB080901 = codes.some(c => c === 'B080901')
  if (hasB08) {
    if (hasB0809 || hasB080901) b08AndOthers++
    else onlyB08++
  }
})
console.log('仅有 B08:', onlyB08)
console.log('B08 且包含 B0809/B080901:', b08AndOthers)

// 模拟用户手动筛选：男、本科、计算机科学与技术、应届生，不限附加条件，且只要岗位中有 B08/B0809/B080901 就匹配
function normalizeMajorCode(value) {
  return value.replace(/[TK]+$/i, '')
}
const majorCodes = ['B080901', 'B0809', 'B08']
const userStyle = positions.filter(p => {
  const genderMatches = p.gender === '男' || p.gender === '不限'
  const educationMatches = 2 >= p.educationLevel
  const positionCodes = p.majorText.match(/\b[AB]\d{2,6}[TK]*\b/g) ?? []
  const majorMatches = majorCodes.some(code => positionCodes.some(pc => normalizeMajorCode(pc) === normalizeMajorCode(code)))
  const graduateMatches = p.source.includes('高校毕业生')
  return genderMatches && educationMatches && majorMatches && graduateMatches
})
console.log('\n用户风格筛选结果（不含附加条件）:', userStyle.length)

// 学历分布
const eduDist = {}
userStyle.forEach(p => { eduDist[p.education] = (eduDist[p.education] || 0) + 1 })
console.log('学历分布:', eduDist)

// source 分布
const srcDist = {}
userStyle.forEach(p => { srcDist[p.source] = (srcDist[p.source] || 0) + 1 })
console.log('来源分布:', srcDist)

// 看看 B08 相关的匹配
const b08Matched = userStyle.filter(p => {
  const codes = p.majorText.match(/\bB\d{2,6}[TK]*\b/g) ?? []
  return codes.some(c => c === 'B08') && !codes.includes('B080901') && !codes.includes('B0809')
})
console.log('\n仅匹配到 B08（工学大类）的岗位数:', b08Matched.length)
console.log('前5条：')
b08Matched.slice(0, 5).forEach(p => console.log(p.unitNumber, p.unit.slice(0,20), p.education, p.source, p.gender, p.city, p.majorText.slice(0, 100)))
