export type JobPosition = {
  id: number
  unitNumber: string
  unit: string
  category: string
  role: string
  work: string
  recruitmentCount: number
  source: string
  education: string
  educationLevel: number
  degree: string
  majorText: string
  majorNames: string[]
  masterTypes: ('学术型硕士' | '专业型硕士')[]
  examSubject: string
  professionalTitle: string
  qualification: string
  otherConditions: string
  additionalConditions: string
  gender: '男' | '女' | '不限'
  city: string
  phone: string
  score: number
  positionType: string
  parsedConditions?: {
    politicalStatus: ('不限' | '中共党员' | '中共预备党员')[]
    schoolRequirement: ('不限' | '985' | '211' | '双一流')[]
    majorMustMatch: boolean
    certificates: string[]
    skills: string[]
    specialExperience: ('不限' | '烈士亲属' | '服役经历' | '其他')[]
    raw: string
  }
}
