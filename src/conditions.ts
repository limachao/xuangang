import type { JobPosition } from './positions'
import type { ClientProfile } from './db'

export type PoliticalStatus = '不限' | '中共党员' | '中共预备党员'
export type SchoolLevel = '不限' | '985' | '211' | '双一流'
export type MajorMatchMode = '不限' | '必须一致'
export type SpecialExperience = '不限' | '烈士亲属' | '服役经历' | '其他'

export type ParsedConditions = {
  politicalStatus: PoliticalStatus[]
  schoolRequirement: SchoolLevel[]
  majorMustMatch: boolean
  certificates: string[]
  skills: string[]
  specialExperience: SpecialExperience[]
  raw: string
}

export type ClientConditions = {
  politicalStatus: PoliticalStatus
  schoolLevel: SchoolLevel
  majorMatchMode: MajorMatchMode
  certificates: string
  specialExperience: SpecialExperience
  specialExperienceNote: string
}

function normalizeText(value: string): string {
  return value
    .replace(/[“”""']/g, '')
    .replace(/[（）()]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function splitConditions(raw: string): string[] {
  return raw.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
}

function detectPolitical(condition: string): PoliticalStatus[] {
  const normalized = normalizeText(condition)
  const result: PoliticalStatus[] = []
  if (/中共党员|中共正式党员|党员/.test(normalized)) result.push('中共党员')
  if (/中共预备党员|预备党员/.test(normalized)) result.push('中共预备党员')
  return result
}

function detectSchool(condition: string): SchoolLevel[] {
  const normalized = normalizeText(condition)
  const result: SchoolLevel[] = []
  if (/985/.test(normalized)) result.push('985')
  if (/211/.test(normalized)) result.push('211')
  if (/双一流|一流大学|一流学科|一流高校/.test(normalized)) result.push('双一流')
  return result
}

function detectMajorMatch(condition: string): boolean {
  const normalized = normalizeText(condition)
  return /专业.{0,4}(与|和|同)?岗位要求一致|专业一致/.test(normalized)
}

function detectSpecialExperience(condition: string): SpecialExperience[] {
  const normalized = normalizeText(condition)
  const result: SpecialExperience[] = []
  if (/烈士|军烈属|因公牺牲|病故军人/.test(normalized)) result.push('烈士亲属')
  if (/服役|退伍|退役军人|军龄/.test(normalized)) result.push('服役经历')
  return result
}

export function parsePositionConditions(position: JobPosition): ParsedConditions {
  const raw = position.additionalConditions || ''
  const parts = splitConditions(raw)

  const politicalStatus: PoliticalStatus[] = []
  const schoolRequirement: SchoolLevel[] = []
  let majorMustMatch = false
  const certificates: string[] = []
  const skills: string[] = []
  const specialExperience: SpecialExperience[] = []

  for (const part of parts) {
    const normalized = normalizeText(part)
    const politics = detectPolitical(part)
    const schools = detectSchool(part)
    const specials = detectSpecialExperience(part)

    if (politics.length > 0) {
      politicalStatus.push(...politics)
    } else if (schools.length > 0) {
      schoolRequirement.push(...schools)
    } else if (detectMajorMatch(part)) {
      majorMustMatch = true
    } else if (specials.length > 0) {
      specialExperience.push(...specials)
    } else if (/证书|资格|执业|职称|等级|专业八级|cet|雅思|托福|计算机等级|普通话/.test(normalized)) {
      certificates.push(part)
    } else if (normalized.length > 0) {
      skills.push(part)
    }
  }

  return {
    politicalStatus: politicalStatus.length > 0 ? politicalStatus : ['不限'],
    schoolRequirement: schoolRequirement.length > 0 ? schoolRequirement : ['不限'],
    majorMustMatch,
    certificates,
    skills,
    specialExperience: specialExperience.length > 0 ? specialExperience : ['不限'],
    raw,
  }
}

function parseClientCertificates(input: string): string[] {
  return input.split(/[;；,，]/).map((s) => s.trim()).filter(Boolean)
}

function politicalMatches(client: PoliticalStatus, position: PoliticalStatus[]): boolean {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  if (client === '中共党员') {
    return position.includes('中共党员') || position.includes('中共预备党员')
  }
  if (client === '中共预备党员') {
    return position.includes('中共预备党员')
  }
  return false
}

function schoolMatches(client: SchoolLevel, position: SchoolLevel[]): boolean {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  // 985 ⊂ 211 ⊂ 双一流：高级别院校可匹配低级别院校要求的岗位
  const hierarchy: SchoolLevel[] = ['985', '211', '双一流']
  const clientIndex = hierarchy.indexOf(client)
  if (clientIndex === -1) return false
  for (let index = clientIndex; index < hierarchy.length; index++) {
    if (position.includes(hierarchy[index])) return true
  }
  return false
}

function specialExperienceMatches(client: SpecialExperience, note: string, position: SpecialExperience[]): boolean {
  if (position.includes('不限')) return true
  if (client === '不限') return false
  if (client === '烈士亲属') return position.includes('烈士亲属')
  if (client === '服役经历') return position.includes('服役经历')
  if (client === '其他') {
    const normalizedNote = normalizeText(note)
    if (!normalizedNote) return false
    return position.some((p) => p === '其他')
  }
  return false
}

function certificateMatches(clientCerts: string[], positionCerts: string[]): boolean {
  if (positionCerts.length === 0) return true
  if (clientCerts.length === 0) return false
  return positionCerts.some((required) => {
    const normalizedRequired = normalizeText(required)
    return clientCerts.some((clientCert) => normalizedRequired.includes(normalizeText(clientCert)))
  })
}

export function conditionsMatch(position: JobPosition, client: ClientProfile): boolean {
  const parsed = position.parsedConditions ?? parsePositionConditions(position)
  const clientConditions: ClientConditions = {
    politicalStatus: (client.politicalStatus || '不限') as PoliticalStatus,
    schoolLevel: (client.schoolLevel || '不限') as SchoolLevel,
    majorMatchMode: (client.majorMatchMode || '不限') as MajorMatchMode,
    certificates: client.certificates || '',
    specialExperience: (client.specialExperience || '不限') as SpecialExperience,
    specialExperienceNote: client.specialExperienceNote || '',
  }

  if (!politicalMatches(clientConditions.politicalStatus, parsed.politicalStatus)) return false
  if (!schoolMatches(clientConditions.schoolLevel, parsed.schoolRequirement)) return false
  if (clientConditions.majorMatchMode === '必须一致' && !parsed.majorMustMatch) return false
  if (!specialExperienceMatches(clientConditions.specialExperience, clientConditions.specialExperienceNote, parsed.specialExperience)) return false
  if (!certificateMatches(parseClientCertificates(clientConditions.certificates), parsed.certificates)) return false

  // 未识别的其他条件：用户必须选择“其他”并填写说明，否则默认不匹配
  if (parsed.skills.length > 0 && clientConditions.specialExperience !== '其他') return false
  if (parsed.skills.length > 0 && clientConditions.specialExperience === '其他' && !normalizeText(clientConditions.specialExperienceNote)) return false

  return true
}
