import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'
import { createAnalysisHistory, deleteAnalysisHistory, getAnalysisHistories, getDraftAnalysis, saveDraftAnalysis, type AnalysisRecord, type ClientProfile } from './db'
import ScreeningV2 from './Screening'
import type { JobPosition } from './positions'
import { ThreeDTestimonials } from './components/ui/three-d-testimonials'
import { conditionsMatch, parsePositionConditions } from './conditions'

type View = 'overview' | 'screening' | 'reports' | 'library' | 'admin'
type AuthUser = { id: string; username: string; name: string; role: 'admin' | 'teacher'; active: boolean }
type MasterType = '学术型硕士' | '专业型硕士'

const majorCategoryMap: Record<string, string> = {
  护理学: '护理学类',
  助产学: '护理学类',
  临床医学: '临床医学类',
  卫生管理: '公共卫生与预防医学类',
  计算机: '计算机类',
  计算机科学与技术: '计算机类',
  土木工程: '土木类',
}

function getMajorCategory(major: string) {
  const normalizedMajor = major.trim()
  return majorCategoryMap[normalizedMajor] ?? (normalizedMajor ? `${normalizedMajor}类` : '')
}

type MajorRecord = { name: string; category: string; level: '专科' | '本科' | '研究生'; codes: string[]; masterTypeByCode: Record<string, MasterType[]> }

function getMajorCodes(catalog: MajorRecord[], major: string, education: string, masterType: ClientProfile['masterType']) {
  const levels = education === '大专' ? ['专科'] : education === '本科' ? ['本科'] : ['研究生']
  const normalizedMajor = major.trim()

  // 先精确匹配该专业
  const exact = catalog.filter((record) => levels.includes(record.level) && record.name === normalizedMajor).flatMap((record) => record.codes.filter((code) => record.level !== '研究生' || !masterType || record.masterTypeByCode[code]?.includes(masterType)))
  if (exact.length > 0) return exact

  // 精确匹配不到时，按专业类别 fallback（如专科助产学按专科护理学类处理）
  const category = catalog.find((record) => record.name === normalizedMajor)?.category
  if (!category) return []

  return catalog.filter((record) => levels.includes(record.level) && record.category === category).flatMap((record) => record.codes.filter((code) => record.level !== '研究生' || !masterType || record.masterTypeByCode[code]?.includes(masterType)))
}

function normalizeMajorCode(value: string) {
  return value.replace(/^([AB])/, '$1').replace(/[TK]+$/, '')
}

const nav: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: '分析总览', icon: '◈' },
  { id: 'screening', label: '岗位筛选', icon: '⌕' },
  { id: 'reports', label: '客户报告', icon: '▤' },
  { id: 'library', label: '知识库', icon: '▥' },
  { id: 'admin', label: '账号管理', icon: '⚙' },
]

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState('')
  const [view, setView] = useState<View>('overview')
  const [client, setClient] = useState<ClientProfile>({ name: '', major: '', education: '本科', masterType: '', status: '', city: '', gender: '', majorCategory: '', otherLimitations: '', score: '', politicalStatus: '不限', schoolLevel: '不限', majorMatchMode: '不限', certificates: '', specialExperience: '不限', specialExperienceNote: '' })
  const [selected, setSelected] = useState<number[]>([1, 3])
  const [reportOpen, setReportOpen] = useState(false)
  const [databaseReady, setDatabaseReady] = useState(false)
  const [searchStarted, setSearchStarted] = useState(false)
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([])
  const [majorCatalog, setMajorCatalog] = useState<MajorRecord[]>([])
  const [histories, setHistories] = useState<AnalysisRecord[]>([])

  useEffect(() => {
    void fetch('/api/auth/me').then((response) => response.ok ? response.json() as Promise<{ user: AuthUser | null }> : { user: null }).then(({ user }) => setAuthUser(user)).catch(() => setAuthUser(null))
  }, [])

  useEffect(() => {
    void fetch('/data/positions.json')
      .then((response) => response.json() as Promise<JobPosition[]>)
      .then((positions) => {
        // 预解析限制条件，避免每次筛选都重复正则解析
        for (const position of positions) {
          if (!position.parsedConditions) {
            position.parsedConditions = parsePositionConditions(position)
          }
        }
        setJobPositions(positions)
      })
      .catch((error: unknown) => {
        console.error('无法读取真实岗位表', error)
      })
  }, [])

  useEffect(() => {
    void fetch('/data/major-catalog.json').then((response) => response.json() as Promise<MajorRecord[]>).then(setMajorCatalog).catch((error: unknown) => {
      console.error('无法读取专业目录', error)
    })
  }, [])

  const loadHistories = async () => {
    try {
      const records = await getAnalysisHistories()
      setHistories(records)
    } catch (error) {
      console.error('无法读取历史报告', error)
    }
  }

  const applyAnalysisRecord = (record: AnalysisRecord) => {
    setClient({
      ...record.client,
      gender: record.client.gender === '男' || record.client.gender === '女' ? record.client.gender : '',
      education: record.client.education === '研究生' ? '硕士研究生' : record.client.education || '本科',
      masterType: record.client.masterType === '学术型硕士' || record.client.masterType === '专业型硕士' ? record.client.masterType : '',
      majorCategory: getMajorCategory(record.client.major),
      otherLimitations: record.client.otherLimitations ?? '',
      score: record.client.score ?? '',
      politicalStatus: record.client.politicalStatus ?? '不限',
      schoolLevel: record.client.schoolLevel ?? '不限',
      majorMatchMode: record.client.majorMatchMode ?? '不限',
      certificates: record.client.certificates ?? '',
      specialExperience: record.client.specialExperience ?? '不限',
      specialExperienceNote: record.client.specialExperienceNote ?? '',
    })
    setSelected(record.selectedPositionIds)
  }

  useEffect(() => {
    void getDraftAnalysis().then((record) => {
      if (record) applyAnalysisRecord(record)
      setDatabaseReady(true)
      void loadHistories()
    }).catch((error: unknown) => {
      console.error('无法读取本地分析数据库', error)
      setDatabaseReady(true)
      void loadHistories()
    })
  }, [])

  useEffect(() => {
    if (!databaseReady) return
    void saveDraftAnalysis({ client, selectedPositionIds: selected, note: '建议优先核对专业名称、资格证要求及具体岗位职责。' }).catch((error: unknown) => {
      console.error('无法保存分析草稿到本地数据库', error)
    })
  }, [client, selected, databaseReady])

  const saveCurrentAsHistory = async () => {
    if (!client.name) {
      alert('请先填写客户姓名，再保存到报告中心')
      setView('screening')
      return
    }
    try {
      await createAnalysisHistory({ client, selectedPositionIds: selected, note: '建议优先核对专业名称、资格证要求及具体岗位职责。' })
      await loadHistories()
      alert('已保存到客户报告')
    } catch (error) {
      console.error('保存历史报告失败', error)
      alert('保存失败，请重试')
    }
  }

  const loadHistory = (record: AnalysisRecord) => {
    applyAnalysisRecord(record)
    setSearchStarted(true)
    setView('screening')
  }

  const deleteHistory = async (id: string) => {
    if (!window.confirm('确定删除这条报告记录吗？')) return
    try {
      await deleteAnalysisHistory(id)
      await loadHistories()
    } catch (error) {
      console.error('删除历史报告失败', error)
      alert('删除失败')
    }
  }


  const filtered = useMemo(() => {
    if (!searchStarted || jobPositions.length === 0) return []
    return jobPositions.filter((position) => {
      const genderMatches = !client.gender
        ? true
        : client.gender === '男'
          ? (position.gender === '男' || position.gender === '不限')
          : (position.gender === '女' || position.gender === '不限')
      const educationLevel = client.education === '大专' ? 1 : client.education === '本科' ? 2 : client.education === '硕士研究生' ? 3 : 4
      const educationMatches = educationLevel >= position.educationLevel
      const majorCodes = getMajorCodes(majorCatalog, client.major, client.education, client.masterType)
      const positionCodes = position.majorText.match(/\b[ABC]\d{2,6}[TK]*\b/g) ?? []
      const majorMatches = majorCodes.some((code) => positionCodes.some((positionCode) => normalizeMajorCode(positionCode) === normalizeMajorCode(code)))
      const broadMasterTypeMatch = positionCodes.some((positionCode) => /^A\d{2}$/.test(normalizeMajorCode(positionCode)))
      const masterTypeMatches = client.education !== '硕士研究生' || position.educationLevel < 3 || broadMasterTypeMatch || (!!client.masterType && position.masterTypes.includes(client.masterType))
      const graduateMatches = client.status === '应届生' ? position.source.includes('高校毕业生') : position.source.includes('社会人才')
      const cityMatches = !client.city || position.city.includes(client.city)
      const limitationMatches = conditionsMatch(position, client)
      return genderMatches && educationMatches && majorMatches && masterTypeMatches && graduateMatches && cityMatches && limitationMatches
    })
  }, [jobPositions, client, searchStarted, majorCatalog])
  const activeSelected = useMemo(() => selected.filter((id) => filtered.some((position) => position.id === id)), [selected, filtered])
  const selectedSet = useMemo(() => new Set(activeSelected), [activeSelected])

  const loggedIn = authUser !== null

  if (!loggedIn) {
    return <main className="login-page">
      <ThreeDTestimonials />
      <form className="login-card" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setLoginError('')
        void fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) })
          .then(async (response) => {
            const body = await response.json() as { user?: AuthUser; message?: string }
            if (!response.ok || !body.user) throw new Error(body.message || '登录失败')
            setAuthUser(body.user)
          })
          .catch((error: unknown) => setLoginError(error instanceof Error ? error.message : '登录失败'))
      }}>
        <div className="login-top"><span>两节课文职选岗系统</span><span>● 内部系统</span></div>
        <h2>选岗系统</h2><p className="muted">登录后继续你的岗位分析</p>
        <label>账号<input name="username" required placeholder="请输入账号" /></label>
        <label>密码<input name="password" required type="password" placeholder="请输入密码" /></label>
        <button className="primary" type="submit">进入工作台 <span>→</span></button>
        {loginError && <small className="login-error">{loginError}</small>}
        <small className="login-note">演示环境 · 数据仅保存在当前浏览器</small>
      </form>
    </main>
  }

  const toggleSelected = (id: number) => setSelected((old) => old.includes(id) ? old.filter((item) => item !== id) : [...old, id])

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div><b>两节课文职选岗系统</b><small>内部工作台</small></div></div>
      <div className="side-label">工作空间</div>
      <nav>{nav.filter((item) => item.id !== 'admin' || authUser?.role === 'admin').map((item) => <button className={view === item.id ? 'nav-item active' : 'nav-item'} key={item.id} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="side-bottom"><div className="health">● <span><b>数据状态正常</b><small>2026 岗位表 · 已审核</small></span></div><button className="account" onClick={() => { void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); setAuthUser(null); setView('overview') }}><span className="avatar">{authUser?.name[0] || '师'}</span><span><b>{authUser?.name}</b><small>退出登录</small></span><span>⋯</span></button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><span><i>工作台 / </i>{nav.find((item) => item.id === view)?.label}</span><div><small>数据更新于 2026.09.10</small><button className="plain">♧</button><button className="help">?</button></div></header>
      <div className="content">
        {view === 'overview' && <Overview go={setView} name={authUser?.name || '老师'} />}
        {view === 'screening' && <ScreeningV2 client={client} setClient={setClient} filtered={filtered} selected={activeSelected} selectedSet={selectedSet} toggle={toggleSelected} openReport={() => setReportOpen(true)} saveHistory={saveCurrentAsHistory} startSearch={() => { if (majorCatalog.length > 0) { setSelected([]); setSearchStarted(true) } }} />}
        {view === 'reports' && <Reports histories={histories} currentName={client.name} currentCount={activeSelected.length} openCurrent={() => setReportOpen(true)} saveCurrentHistory={saveCurrentAsHistory} loadHistory={loadHistory} deleteHistory={deleteHistory} />}
        {view === 'library' && <Library />}
        {view === 'admin' && authUser?.role === 'admin' && <AdminUsers />}
      </div>
    </section>
    {reportOpen && <ReportModal name={client.name} positions={filtered} selected={activeSelected} close={() => setReportOpen(false)} />}
  </main>
}

function AdminUsers() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const loadUsers = () => void fetch('/api/admin/users', { credentials: 'include' }).then((response) => response.json() as Promise<{ users: AuthUser[] }>).then(({ users: nextUsers }) => setUsers(nextUsers))
  useEffect(loadUsers, [])

  const createUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, username, password }) }).then(async (response) => {
      const body = await response.json() as { message?: string }
      if (!response.ok) throw new Error(body.message || '创建失败')
      setName(''); setUsername(''); setPassword(''); setMessage('老师账号已创建'); loadUsers()
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '创建失败'))
  }

  const updateUser = (user: AuthUser) => {
    const nextPassword = window.prompt(`为 ${user.name} 设置新密码（留空则只切换状态）`)
    if (nextPassword === null) return
    void fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ password: nextPassword || undefined, active: !user.active }) }).then(() => { setMessage('账号信息已更新'); loadUsers() })
  }

  const deleteUser = (user: AuthUser) => {
    if (!window.confirm(`确定删除 ${user.name} 的账号吗？`)) return
    void fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', credentials: 'include' }).then(() => { setMessage('账号已删除'); loadUsers() })
  }

  return <div className="admin-page"><div className="heading compact"><div><p className="eyebrow">管理员控制台</p><h1>账号管理</h1><p className="muted">为每位老师创建独立账号，并管理登录权限。</p></div></div><section className="admin-create form-panel"><div className="form-title"><span className="step-num">＋</span><div><h2>新增老师账号</h2><p>初始密码交给老师后，建议首次登录立即修改。</p></div></div><form className="admin-create-form" onSubmit={createUser}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="老师姓名" required /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="登录账号" required /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="初始密码" type="password" minLength={8} required /><button className="primary" type="submit">创建账号</button></form>{message && <p className="admin-message">{message}</p>}</section><section className="admin-list panel"><div className="panel-head"><div><h2>现有账号</h2><p>管理员账号不可被删除。</p></div></div>{users.map((user) => <div className="admin-user" key={user.id}><span className="avatar">{user.name[0]}</span><div><b>{user.name}</b><small>{user.username} · {user.role === 'admin' ? '超级管理员' : '老师账号'}</small></div><span className={user.active ? 'user-status active' : 'user-status'}>{user.active ? '正常' : '已停用'}</span>{user.role !== 'admin' && <><button className="text-button" onClick={() => updateUser(user)}>改密 / {user.active ? '停用' : '启用'}</button><button className="text-button danger-button" onClick={() => deleteUser(user)}>删除</button></>}</div>)}</section></div>
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '晚上好'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function Overview({ go, name }: { go: (view: View) => void; name: string }) {
  const quotes = ['路漫漫其修远兮，吾将上下而求索。', '不积跬步，无以至千里；不积小流，无以成江海。', '业精于勤，荒于嬉；行成于思，毁于随。', '纸上得来终觉浅，绝知此事要躬行。', '千里之行，始于足下。', '长风破浪会有时，直挂云帆济沧海。']
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)])
  const greeting = getGreeting()
  return <><div className="heading"><div><p className="eyebrow">{greeting}，{name}</p><h1 className="quote-title">{quote}</h1></div><button className="primary" onClick={() => go('screening')}>＋ 新建选岗分析</button></div><div className="stats"><Stat label="本周分析客户" value="18" hint="↑ 12% 较上周" good /><Stat label="待处理报告" value="6" hint="需要你确认" /><Stat label="岗位知识库" value="2,486" hint="2026 岗位 · 已审核" /><Stat label="平均分析耗时" value="14 min" hint="↓ 28% 较上月" good /></div><div className="dashboard"><section className="panel"><PanelHead title="最近的客户分析" sub="继续处理最近的选岗工作" action="查看全部 →" onClick={() => go('reports')} />{['周同学 · 护理学', '陈同学 · 计算机科学与技术', '王同学 · 会计学'].map((name, index) => <div className="recent" key={name}><span className="avatar">{name[0]}</span><div><b>{name}</b><small>{index === 1 ? '推荐 8 个岗位' : index === 2 ? '待补充目标地区' : '报告待确认'}</small></div><span className="tag orange">{index === 2 ? '草稿' : '待确认'}</span><time>今天 09:2{index}</time><span>→</span></div>)}</section><section className="panel"><PanelHead title="选岗提醒" sub="知识库给你的工作提示" action="✦" /><div className="insight"><b>2026 数据需要更新关注</b><p>近期有 12 个岗位的进面分数线已补充，建议发送报告前重新核对。</p><button className="text-button" onClick={() => go('library')}>去知识库查看 →</button></div><div className="source">◉ <span><b>专家观点已整理</b><small>3 条新内容等待审核</small></span><span>→</span></div></section></div></>
}
function Stat({ label, value, hint, good }: { label: string; value: string; hint: string; good?: boolean }) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small className={good ? 'good' : ''}>{hint}</small></div> }
function PanelHead({ title, sub, action, onClick }: { title: string; sub: string; action: string; onClick?: () => void }) { return <div className="panel-head"><div><h2>{title}</h2><p>{sub}</p></div><button className="text-button" onClick={onClick}>{action}</button></div> }

function Reports({ histories, currentName, currentCount, openCurrent, saveCurrentHistory, loadHistory, deleteHistory }: { histories: AnalysisRecord[]; currentName: string; currentCount: number; openCurrent: () => void; saveCurrentHistory: () => void; loadHistory: (record: AnalysisRecord) => void; deleteHistory: (id: string) => void }) {
  return <div className="reports-page"><div className="heading compact"><div><p className="eyebrow">报告中心</p><h1>客户报告</h1><p className="muted">按客户姓名和时间保存的历史分析记录。</p></div><button className="primary" onClick={saveCurrentHistory}>保存当前分析到报告</button></div><section className="panel"><div className="panel-head"><div><h2>当前草稿</h2><p>正在编辑的报告，刷新页面后会自动恢复</p></div></div><div className="report-card"><span className="tag orange">待确认</span><small>最后编辑：今天 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small><h2>{currentName || '未填写客户姓名'}的军队文职选岗建议</h2><p>基于 2026 年岗位表，为你整理了 {currentCount} 个重点关注岗位。</p><button className="primary" onClick={openCurrent}>打开报告草稿 →</button></div></section><section className="panel"><div className="panel-head"><div><h2>历史报告</h2><p>按保存时间倒序排列</p></div></div>{histories.length === 0 ? <div className="empty-state">暂无历史报告，去"岗位筛选"页面填写客户信息后点击"保存到客户报告"。</div> : histories.map((history) => <div className="recent" key={history.id}><span className="avatar">{history.client.name[0] || '客'}</span><div><b>{history.client.name || '未命名客户'}</b><small>{new Date(history.updatedAt).toLocaleString('zh-CN')} · {history.selectedPositionIds.length} 个选中岗位</small></div><button className="text-button" onClick={() => loadHistory(history)}>加载</button><button className="text-button danger-button" onClick={() => deleteHistory(history.id)}>删除</button></div>)}</section></div>
}
function Library() { return <div className="empty"><p className="eyebrow">资料管理</p><h1>知识库</h1><p className="muted">官方事实、专家经验和内部资料在这里分层管理。</p><div className="library"><div><b>▤ 官方资料</b><strong>24</strong><small>2026 岗位表 · 已审核</small></div><div><b>◌ 专家观点</b><strong>186</strong><small>3 条内容待审核</small></div><div><b>▥ 内部文档</b><strong>42</strong><small>全部已发布</small></div></div><div className="notice">✓ 内容发布前需由管理员审核。专家经验只用于“怎么选”，不能替代官方报考条件。</div></div> }
function ReportModal({ name, positions, selected, close }: { name: string; positions: JobPosition[]; selected: number[]; close: () => void }) { return <div className="backdrop" onClick={close}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">报告草稿 · 未发送</p><h2>{name || '周同学'}的选岗建议</h2></div><button onClick={close}>×</button></div><p className="modal-copy">系统已经整理好岗位建议，请老师审核、修改后再发送给客户。</p>{positions.filter((position) => selected.includes(position.id)).map((position) => <div className="modal-row" key={position.id}><span><b>{position.unit}</b><small>{position.role || position.work} · {position.city} · 招录 {position.recruitmentCount} 人</small></span><em className="result green">待人工审核</em></div>)}<label className="comment">老师补充说明<textarea defaultValue="建议优先核对专业名称、资格证要求及具体岗位职责。" /></label><div className="modal-footer"><small>发送前请完成人工审核</small><button className="primary" onClick={close}>确认报告并复制</button></div></div></div> }

export default App
