export type ClientProfile = {
  name: string
  major: string
  education: string
  masterType: '学术型硕士' | '专业型硕士' | ''
  status: string
  city: string
  gender: '男' | '女' | '不限' | ''
  majorCategory: string
  otherLimitations: string
  score: string
  politicalStatus: '不限' | '中共党员' | '中共预备党员'
  schoolLevel: '不限' | '985' | '211' | '双一流'
  majorMatchMode: '不限' | '必须一致'
  certificates: string
  specialExperience: '不限' | '烈士亲属' | '服役经历' | '其他'
  specialExperienceNote: string
}

export type AnalysisRecord = {
  id: string
  client: ClientProfile
  selectedPositionIds: number[]
  note: string
  updatedAt: string
}

const databaseName = 'junzhuwenxizuangang'
const storeName = 'analyses'
const draftId = 'draft'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// 当前编辑的草稿：刷新页面后自动恢复
export async function getDraftAnalysis(): Promise<AnalysisRecord | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(draftId)
    request.onsuccess = () => resolve(request.result as AnalysisRecord | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function saveDraftAnalysis(record: Omit<AnalysisRecord, 'id' | 'updatedAt'>): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put({
      ...record,
      id: draftId,
      updatedAt: new Date().toISOString(),
    })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// 历史报告记录：按客户姓名 + 时间保存多条
export async function createAnalysisHistory(record: Omit<AnalysisRecord, 'id' | 'updatedAt'>): Promise<string> {
  const database = await openDatabase()
  const id = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put({
      ...record,
      id,
      updatedAt: new Date().toISOString(),
    })
    request.onsuccess = () => resolve(id)
    request.onerror = () => reject(request.error)
  })
}

export async function getAnalysisHistories(): Promise<AnalysisRecord[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).openCursor()
    const results: AnalysisRecord[] = []
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        const record = cursor.value as AnalysisRecord
        if (record.id !== draftId) results.push(record)
        cursor.continue()
      } else {
        resolve(results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function deleteAnalysisHistory(id: string): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
