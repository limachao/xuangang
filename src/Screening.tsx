import { useEffect, useMemo, useState } from 'react'
import type { ClientProfile } from './db'
import type { JobPosition } from './positions'
import * as XLSX from 'xlsx'

const PAGE_SIZE = 100

type ScreeningProps = {
  client: ClientProfile
  setClient: (value: ClientProfile) => void
  filtered: JobPosition[]
  selected: number[]
  selectedSet?: Set<number>
  toggle: (id: number) => void
  openReport: () => void
  saveHistory: () => void
  startSearch: () => void
}

function Screening({ client, setClient, filtered, selected, selectedSet, toggle, openReport, saveHistory, startSearch }: ScreeningProps) {
  const isMasterStudent = client.education === '硕士研究生'
  const [page, setPage] = useState(1)
  // 专业名称、目标地区和学生笔试分数使用本地输入缓冲，避免每次按键都触发全局状态重渲染
  const [majorInput, setMajorInput] = useState(client.major)
  const [cityInput, setCityInput] = useState(client.city)
  const [scoreInput, setScoreInput] = useState(client.score)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length])
  const pagePositions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1)
  }, [filtered.length])

  // 外部恢复历史记录时同步输入框
  useEffect(() => {
    setMajorInput(client.major)
    setCityInput(client.city)
    setScoreInput(client.score)
  }, [client.major, client.city, client.score])

  const selection = selectedSet ?? new Set(selected)

  const downloadResults = () => {
    const rows = filtered.map((position) => ({
      岗位编号: position.unitNumber,
      单位名称: position.unit,
      岗位名称: position.role || position.work,
      工作地点: position.city,
      招录人数: position.recruitmentCount,
      性别要求: position.gender,
      学历要求: position.education,
      学位要求: position.degree,
      硕士类型: position.masterTypes.join(' / '),
      专业要求: position.majorText,
      考试科目: position.examSubject,
      专业技术资格: position.professionalTitle,
      报考资格: position.qualification,
      其他条件: position.additionalConditions,
      岗位来源: position.source,
      历史进面分: position.score,
      岗位类别: position.positionType,
      联系电话: position.phone,
    }))
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
      { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 46 }, { wch: 14 }, { wch: 20 },
      { wch: 26 }, { wch: 48 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(workbook, worksheet, '筛选岗位')
    XLSX.writeFile(workbook, `${client.major || '岗位'}筛选结果_${filtered.length}个.xlsx`)
  }

  const submitSearch = () => {
    // 强制把输入框里的专业名称、目标地区和学生笔试分数同步到客户画像，避免输入过程中频繁重渲染，同时保证搜索用最新值
    const nextClient = { ...client, major: majorInput.trim(), city: cityInput.trim(), score: scoreInput.trim() }
    setClient(nextClient)
    if (!nextClient.gender || !nextClient.education || !nextClient.major || !nextClient.status || (isMasterStudent && !nextClient.masterType)) return
    startSearch()
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
  }

  const updateEducation = (education: string) => {
    setClient({ ...client, education, masterType: education === '硕士研究生' ? client.masterType : '' })
  }

  return <>
    <div className="heading compact">
      <div>
        <p className="eyebrow">客户选岗分析</p>
        <h1>新建一份岗位建议</h1>
        <p className="muted">填写必要条件，查看全部符合资格的岗位。</p>
      </div>
      <span className="step">01 / 客户信息</span>
    </div>

    <section className="form-panel">
      <div className="form-title">
        <span className="step-num">01</span>
        <div><h2>客户基本信息</h2><p>性别、学历、专业名称和应届身份为必填条件</p></div>
        <small>* 必填信息</small>
      </div>
      <div className="form-grid">
        <label>专业名称<input value={majorInput} onChange={(event) => setMajorInput(event.target.value)} placeholder="例如：计算机、护理学或土木工程" /></label>
        <label>性别<select value={client.gender} onChange={(event) => setClient({ ...client, gender: event.target.value as ClientProfile['gender'] })}><option value="">请选择</option><option value="男">男</option><option value="女">女</option></select></label>
        <label>最高学历<select value={client.education} onChange={(event) => updateEducation(event.target.value)}><option value="本科">本科</option><option value="大专">大专</option><option value="硕士研究生">硕士研究生</option><option value="博士">博士</option></select></label>
        {isMasterStudent && <label>硕士类型<select value={client.masterType} onChange={(event) => setClient({ ...client, masterType: event.target.value as ClientProfile['masterType'] })}><option value="">请选择</option><option value="学术型硕士">学术型硕士</option><option value="专业型硕士">专业型硕士</option></select></label>}
        <label>应届生身份<select value={client.status} onChange={(event) => setClient({ ...client, status: event.target.value })}><option value="">请选择</option><option value="应届生">应届生</option><option value="社会人才">社会人才</option></select></label>
        <label>学生笔试分数<input type="number" min="0" value={scoreInput} onChange={(event) => setScoreInput(event.target.value)} placeholder="例如：128" /></label>
        <label>目标地区<input value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="不填则展示所有符合地区" /></label>
        <label>政治面貌<select value={client.politicalStatus} onChange={(event) => setClient({ ...client, politicalStatus: event.target.value as ClientProfile['politicalStatus'] })}><option value="不限">不限</option><option value="中共党员">中共党员</option><option value="中共预备党员">中共预备党员</option></select></label>
        <label>毕业院校<select value={client.schoolLevel} onChange={(event) => setClient({ ...client, schoolLevel: event.target.value as ClientProfile['schoolLevel'] })}><option value="不限">不限</option><option value="985">985</option><option value="211">211</option><option value="双一流">双一流</option></select></label>
        <label>专业匹配<select value={client.majorMatchMode} onChange={(event) => setClient({ ...client, majorMatchMode: event.target.value as ClientProfile['majorMatchMode'] })}><option value="不限">不限</option><option value="必须一致">必须一致</option></select></label>
        <label>资格证书<input value={client.certificates} onChange={(event) => setClient({ ...client, certificates: event.target.value })} placeholder="例如：英语六级；计算机二级（多条用分号隔开）" /></label>
        <label>特殊经历<select value={client.specialExperience} onChange={(event) => setClient({ ...client, specialExperience: event.target.value as ClientProfile['specialExperience'] })}><option value="不限">不限</option><option value="烈士亲属">烈士亲属</option><option value="服役经历">服役经历</option><option value="其他">其他</option></select></label>
        {client.specialExperience === '其他' && <label className="wide">其他特殊经历说明<input value={client.specialExperienceNote} onChange={(event) => setClient({ ...client, specialExperienceNote: event.target.value })} placeholder="请填写岗位附加条件中涉及的特殊说明" /></label>}
      </div>
      <div className="form-footer">
        <span>{isMasterStudent ? '硕士类型为必填条件；不包含基层工作经验条件' : '只展示符合条件的全部岗位；其他条件按勾选内容匹配'}</span>
        <button className="primary" onClick={submitSearch}>开始筛选岗位 →</button>
      </div>
    </section>

    <section id="results">
      <div className="results-head"><div><p className="eyebrow">2026 历史参考数据</p><h2>符合条件的岗位 <b>{filtered.length}</b></h2></div><button className="primary" onClick={downloadResults} disabled={filtered.length === 0}>下载 Excel</button></div>
      <div className="notice"><span>i</span>以下为岗位表中符合性别、学历、培养类型、应届身份、地区和专业条件的全部岗位，学生分数仅作参考。</div>
      <div className="positions">
        {pagePositions.map((position) => <article className="position" key={position.id}>
          <div className="check"><input type="checkbox" checked={selection.has(position.id)} onChange={() => toggle(position.id)} /></div>
          <div className="position-body">
            <div><span className="result green">符合条件</span><small>岗位编号 {position.unitNumber}</small></div>
            <h3>{position.unit}</h3>
            <p>{position.role || position.work} <i>·</i> {position.city}</p>
            <div className="meta"><span>性别：{position.gender}</span><span>学历：{position.education}</span>{position.masterTypes.length > 0 && <span>硕士类型：{position.masterTypes.join(' / ')}</span>}<span>历史进面：<b>{position.score}</b> 分</span></div>
            <small className="note">专业要求：{position.majorText}</small>
          </div>
          <div className="risk"><small>历史分数</small><strong>{position.score || '--'}</strong><small>仅供参考</small></div>
        </article>)}
      </div>
      {filtered.length > PAGE_SIZE && <div className="pagination">
        <button className="plain" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
        <span>第 {page} / {totalPages} 页（共 {filtered.length} 个岗位）</span>
        <button className="plain" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
      </div>}
      <div className="results-footer"><span>已选择 {selected.length} 个岗位用于报告草稿</span><div className="results-actions"><button className="primary" onClick={downloadResults} disabled={filtered.length === 0}>下载 {filtered.length} 个岗位</button><button className="secondary" onClick={saveHistory}>保存到客户报告</button><button className="primary" onClick={openReport}>查看报告草稿 →</button></div></div>
    </section>
  </>
}

export default Screening