import { createServer } from 'node:http'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dataPath = join(root, 'server', 'users.json')
const port = Number(process.env.AUTH_PORT || 8787)
const sessions = new Map()

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function verifyPassword(password, stored) {
  const [salt, value] = stored.split(':')
  if (!salt || !value) return false
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(value, 'hex')
  return expected.length === actual.length && timingSafeEqual(actual, expected)
}

function loadUsers() {
  if (!existsSync(dataPath)) {
    const users = [{ id: 'admin', username: 'admin', name: '超级管理员', role: 'admin', active: true, passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'ChangeMe123!'), createdAt: new Date().toISOString() }]
    writeFileSync(dataPath, JSON.stringify(users, null, 2))
    return users
  }
  return JSON.parse(readFileSync(dataPath, 'utf8'))
}

function saveUsers(users) {
  writeFileSync(dataPath, JSON.stringify(users, null, 2))
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  let text = ''
  for await (const chunk of request) text += chunk
  return text ? JSON.parse(text) : {}
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user
  return safeUser
}

function getSessionUser(request, users) {
  const token = request.headers.cookie?.match(/session=([^;]+)/)?.[1]
  const userId = token ? sessions.get(token) : undefined
  return users.find((user) => user.id === userId && user.active)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`)
  const users = loadUsers()
  try {
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const { username, password } = await readBody(request)
      const user = users.find((item) => item.username === username && item.active)
      if (!user || !verifyPassword(password || '', user.passwordHash)) return send(response, 401, { message: '账号或密码错误' })
      const token = randomUUID()
      sessions.set(token, user.id)
      return send(response, 200, { user: publicUser(user) }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` })
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = request.headers.cookie?.match(/session=([^;]+)/)?.[1]
      if (token) sessions.delete(token)
      return send(response, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' })
    }

    const currentUser = getSessionUser(request, users)
    if (request.method === 'GET' && url.pathname === '/api/auth/me') return send(response, 200, { user: currentUser ? publicUser(currentUser) : null })
    if (!currentUser) return send(response, 401, { message: '请先登录' })
    if (url.pathname.startsWith('/api/admin/') && currentUser.role !== 'admin') return send(response, 403, { message: '只有超级管理员可以执行此操作' })

    if (request.method === 'GET' && url.pathname === '/api/admin/users') return send(response, 200, { users: users.map(publicUser) })

    if (url.pathname === '/api/admin/users' && request.method === 'POST') {
      const body = await readBody(request)
      if (!body.username || !body.name || !body.password) return send(response, 400, { message: '账号、姓名和初始密码不能为空' })
      if (users.some((user) => user.username === body.username)) return send(response, 409, { message: '账号已存在' })
      const user = { id: randomUUID(), username: body.username, name: body.name, role: 'teacher', active: true, passwordHash: hashPassword(body.password), createdAt: new Date().toISOString() }
      users.push(user)
      saveUsers(users)
      return send(response, 201, { user: publicUser(user) })
    }

    const userId = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)?.[1]
    if (userId && request.method === 'PATCH') {
      const user = users.find((item) => item.id === userId)
      if (!user) return send(response, 404, { message: '账号不存在' })
      const body = await readBody(request)
      if (body.name !== undefined) user.name = body.name
      if (body.active !== undefined) user.active = Boolean(body.active)
      if (body.password) user.passwordHash = hashPassword(body.password)
      saveUsers(users)
      return send(response, 200, { user: publicUser(user) })
    }

    if (userId && request.method === 'DELETE') {
      if (userId === currentUser.id) return send(response, 400, { message: '不能删除当前登录账号' })
      const nextUsers = users.filter((user) => user.id !== userId)
      saveUsers(nextUsers)
      return send(response, 200, { ok: true })
    }

    return send(response, 404, { message: '接口不存在' })
  } catch (error) {
    console.error(error)
    return send(response, 500, { message: '服务器内部错误' })
  }
})

server.listen(port, () => console.log(`Auth server listening on http://localhost:${port}`))
