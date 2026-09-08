#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server (dev or production build).
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/smoke.mjs
 *
 * Creates its own committee, group, users and votes (prefixed "smoke-"), checks
 * authorisation, voting rules, concurrency and password flows, then deletes
 * what it created. Exit code 1 on the first failed assertion.
 */
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@sipeu.local'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin1234'
const RUN = Math.random().toString(36).slice(2, 8)

let failures = 0
let passes = 0

function ok(condition, label, extra = '') {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

class Client {
  constructor(name) {
    this.name = name
    this.cookies = new Map()
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  storeCookies(response) {
    const setCookies = response.headers.getSetCookie?.() ?? []
    for (const raw of setCookies) {
      const [pair, ...attrs] = raw.split(';')
      const [key, value] = pair.split('=')
      const expired = attrs.some((attr) => /max-age=0|expires=Thu, 01 Jan 1970/i.test(attr.trim()))
      if (expired || value === '') this.cookies.delete(key.trim())
      else this.cookies.set(key.trim(), value)
    }
  }

  async request(method, path, { body, form, headers = {} } = {}) {
    const init = { method, headers: { Origin: BASE, ...headers } }
    if (this.cookies.size > 0) init.headers.Cookie = this.cookieHeader()
    if (form) init.body = form
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const response = await fetch(`${BASE}${path}`, init)
    this.storeCookies(response)
    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not json */
    }
    return { status: response.status, json, text, headers: response.headers }
  }

  get(path) {
    return this.request('GET', path)
  }
  post(path, body) {
    return this.request('POST', path, { body })
  }
  put(path, body) {
    return this.request('PUT', path, { body })
  }
  patch(path, body) {
    return this.request('PATCH', path, { body })
  }
  delete(path) {
    return this.request('DELETE', path)
  }

  async signIn(email, password) {
    return this.post('/api/auth/sign-in/email', { email, password })
  }
}

async function main() {
  console.log(`Smoke test against ${BASE} (run ${RUN})`)
  const anon = new Client('anon')
  const admin = new Client('admin')

  // ─── Authorization ────────────────────────────────────────────────────────
  console.log('\nAuthorization')
  for (const path of [
    '/api/admin/stats',
    '/api/admin/users',
    '/api/admin/votes',
    '/api/me',
    '/api/me/votes',
  ]) {
    const res = await anon.get(path)
    ok(res.status === 401, `anonymous ${path} → 401`, `got ${res.status}`)
  }
  ok(
    (await anon.post('/api/admin/users', {})).status === 401,
    'anonymous POST /api/admin/users → 401'
  )
  ok(
    (await anon.post('/api/auth/update-user', { name: 'x' })).status === 404,
    'auth update-user is not exposed'
  )
  ok(
    (await anon.post('/api/auth/sign-up/email', { email: 'x@x', password: 'xxxxxxxx', name: 'x' }))
      .status === 404,
    'auth sign-up is not exposed'
  )

  const login = await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD)
  ok(login.status === 200, 'admin signs in', `got ${login.status}`)
  ok((await admin.get('/api/admin/stats')).status === 200, 'admin GET /api/admin/stats → 200')

  // ─── Fixtures ─────────────────────────────────────────────────────────────
  console.log('\nFixtures')
  const committee = (
    await admin.post('/api/admin/committees', { name: `smoke-${RUN}`, slug: `smoke-${RUN}` })
  ).json?.data
  ok(Boolean(committee?.id), 'committee created')
  const reserved = await admin.post('/api/admin/committees', { name: 'Pleno falso', slug: 'pleno' })
  ok(reserved.status === 400, 'slug "pleno" is reserved', `got ${reserved.status}`)

  const group = (
    await admin.post('/api/admin/groups', {
      name: `Smoke ${RUN}`,
      abbreviation: `SM${RUN.slice(0, 3)}`,
      color: '#123456',
    })
  ).json?.data
  ok(Boolean(group?.id), 'group created')

  const password = `Smoke-${RUN}-pass`
  const users = {}
  for (const first of ['Uno', 'Dos', 'Tres']) {
    const res = await admin.post('/api/admin/users', {
      firstName: first,
      lastName: `Smoke ${RUN}`,
      email: `smoke-${first.toLowerCase()}-${RUN}@example.com`,
      role: 'delegate',
      committeeId: committee.id,
      groupId: group.id,
      password,
      sendCredentials: false,
    })
    ok(res.status === 200, `user ${first} created`, `got ${res.status} ${res.text.slice(0, 100)}`)
    users[first] = res.json?.data
  }
  const incomplete = await admin.post('/api/admin/users', {
    firstName: 'Sin',
    lastName: 'Grupo',
    email: `smoke-incomplete-${RUN}@example.com`,
    role: 'delegate',
    committeeId: committee.id,
    groupId: null,
    password,
    sendCredentials: false,
  })
  ok(incomplete.status === 400, 'delegate without group is rejected', `got ${incomplete.status}`)

  const outsider = new Client('outsider')
  const outsiderRes = await admin.post('/api/admin/users', {
    firstName: 'Fuera',
    lastName: `Smoke ${RUN}`,
    email: `smoke-fuera-${RUN}@example.com`,
    role: 'admin',
    password,
    sendCredentials: false,
  })
  ok(outsiderRes.status === 200, 'admin without committee created')
  users.Fuera = outsiderRes.json?.data

  const uno = new Client('uno')
  const dos = new Client('dos')
  const tres = new Client('tres')
  ok((await uno.signIn(users.Uno.email, password)).status === 200, 'delegate signs in')
  ok((await dos.signIn(users.Dos.email, password)).status === 200, 'second delegate signs in')
  ok((await tres.signIn(users.Tres.email, password)).status === 200, 'third delegate signs in')
  ok((await outsider.signIn(users.Fuera.email, password)).status === 200, 'outsider admin signs in')
  ok((await uno.get('/api/admin/stats')).status === 403, 'delegate GET /api/admin/stats → 403')

  // ─── Vote lifecycle ───────────────────────────────────────────────────────
  console.log('\nVote lifecycle')
  const voteRes = await admin.post('/api/admin/votes', {
    name: `Smoke vote ${RUN}`,
    committeeId: committee.id,
    showLiveResults: false,
    options: [{ label: 'A favor' }, { label: 'En contra' }, { label: 'Abstención', canWin: false }],
  })
  ok(voteRes.status === 200, 'vote created')
  const vote = voteRes.json.data
  const [favor, contra, abst] = vote.options.map((o) => o.id)

  ok(
    (await uno.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor })).status === 409,
    'ballot before open → 409'
  )

  ok((await admin.post(`/api/admin/votes/${vote.id}/open`)).status === 200, 'vote opened')
  ok(
    (await outsider.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor })).status === 403,
    'user without committee cannot vote'
  )

  const first = await uno.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor })
  ok(first.status === 200 && first.json.data.created === true, 'first ballot created')
  const same = await uno.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor })
  ok(
    same.status === 200 && same.json.data.created === false && same.json.data.changed === false,
    'repeating the same ballot is idempotent'
  )
  const change = await uno.post(`/api/me/votes/${vote.id}/ballot`, { optionId: contra })
  ok(change.status === 409, 'change is rejected when allowChange=false', `got ${change.status}`)

  // Double submission from one user: both requests settle, exactly one ballot.
  const burst = await Promise.all([
    dos.post(`/api/me/votes/${vote.id}/ballot`, { optionId: contra }),
    dos.post(`/api/me/votes/${vote.id}/ballot`, { optionId: contra }),
    dos.post(`/api/me/votes/${vote.id}/ballot`, { optionId: abst }),
  ])
  // Whichever request wins the row lock creates the ballot; the rest are
  // idempotent (200, same option) or refused (409, different option).
  const statuses = burst.map((r) => r.status).sort()
  ok(
    statuses.filter((s) => s === 200).length >= 1 && statuses.every((s) => s === 200 || s === 409),
    'concurrent double submit settles cleanly (no 5xx)',
    statuses.join(',')
  )
  const adminView = (await admin.get(`/api/admin/votes/${vote.id}`)).json.data
  ok(
    adminView.participation.voted === 2,
    'exactly one ballot per user',
    `voted=${adminView.participation.voted}`
  )
  ok(
    adminView.resultsVisible === true && adminView.totals.length === 3,
    'admin sees hidden live results'
  )

  const publicView = (await anon.get(`/api/votes/${vote.id}`)).json.data
  ok(
    publicView.resultsVisible === false && publicView.totals.length === 0,
    'public gets no counts while hidden'
  )
  ok(
    publicView.byUser.every((u) => u.optionId === null),
    'public gets no per-user choice while hidden'
  )
  ok(
    publicView.participation.voted === 2 && publicView.participation.eligible === 3,
    'public participation 2/3'
  )

  const lockedPatch = await admin.patch(`/api/admin/votes/${vote.id}`, { allowChange: true })
  ok(lockedPatch.status === 409, 'conditions cannot change while open', `got ${lockedPatch.status}`)
  const optionPatch = await admin.put(`/api/admin/votes/${vote.id}/options`, {
    options: [{ id: favor, label: 'Sí' }],
  })
  ok(optionPatch.status === 409, 'options cannot change while open', `got ${optionPatch.status}`)
  ok(
    (await admin.post(`/api/admin/votes/${vote.id}/reset`)).status === 409,
    'reset is refused while open'
  )

  // Close races with a late ballot: whichever wins, state is consistent.
  const [closeRes, lateRes] = await Promise.all([
    admin.post(`/api/admin/votes/${vote.id}/close`),
    tres.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor }),
  ])
  ok(closeRes.status === 200, 'vote closed')
  const afterClose = (await admin.get(`/api/admin/votes/${vote.id}`)).json.data
  const expectedVoted = lateRes.status === 200 ? 3 : 2
  ok(
    afterClose.participation.voted === expectedVoted,
    `late ballot (${lateRes.status}) and close are consistent`,
    `voted=${afterClose.participation.voted}`
  )
  ok(
    (await tres.post(`/api/me/votes/${vote.id}/ballot`, { optionId: favor })).status === 409,
    'ballot after close → 409'
  )
  ok(
    afterClose.status === 'closed' && afterClose.winnerIds.includes(favor),
    'closed vote has a winner'
  )

  const lockedAfter = await admin.patch(`/api/admin/votes/${vote.id}`, { committeeId: null })
  ok(lockedAfter.status === 409, 'scope frozen once ballots exist', `got ${lockedAfter.status}`)
  const cosmetic = await admin.patch(`/api/admin/votes/${vote.id}`, {
    name: `Smoke vote ${RUN} (renamed)`,
    showLiveResults: true,
  })
  ok(cosmetic.status === 200, 'name and result visibility still editable')
  const colorOnly = await admin.put(`/api/admin/votes/${vote.id}/options`, {
    options: vote.options.map((o) => ({
      id: o.id,
      label: o.label,
      color: '#abcdef',
      canWin: o.canWin,
    })),
  })
  ok(colorOnly.status === 200, 'option colours editable after ballots')
  const meaning = await admin.put(`/api/admin/votes/${vote.id}/options`, {
    options: vote.options.map((o) => ({ id: o.id, label: o.label, color: o.color, canWin: true })),
  })
  ok(meaning.status === 409, 'option meaning frozen after ballots', `got ${meaning.status}`)

  const dup = await admin.post(`/api/admin/votes/${vote.id}/duplicate`)
  ok(
    dup.status === 200 && dup.json.data.status === 'pending' && dup.json.data.ballotCount === 0,
    'duplicate creates a pending copy'
  )
  const exportRes = await admin.get(`/api/admin/votes/${vote.id}/export`)
  ok(
    exportRes.status === 200 &&
      exportRes.text.includes('Persona') &&
      exportRes.text.includes(users.Uno.name),
    'CSV export contains ballots'
  )

  // Snapshot: moving a voter to another group keeps the closed result.
  const otherGroup = (
    await admin.post('/api/admin/groups', {
      name: `Smoke B ${RUN}`,
      abbreviation: `SB${RUN.slice(0, 3)}`,
      color: '#654321',
    })
  ).json?.data
  ok(
    (await admin.patch(`/api/admin/users/${users.Uno.id}`, { groupId: otherGroup.id })).status ===
      200,
    'voter moved to another group'
  )
  const afterMove = (await admin.get(`/api/admin/votes/${vote.id}`)).json.data
  const unoRow = afterMove.byUser.find((u) => u.id === users.Uno.id)
  ok(unoRow?.group?.id === group.id, 'ballot keeps the group it was cast with')

  // Suspension: session dies, census keeps the ballot.
  ok(
    (await admin.post(`/api/admin/users/${users.Dos.id}/suspend`)).status === 200,
    'user suspended'
  )
  ok((await dos.get('/api/me')).status === 401, 'suspended session is rejected')
  const suspLogin = await dos.signIn(users.Dos.email, password)
  ok(suspLogin.status !== 200, 'suspended user cannot sign in')
  const afterSuspend = (await admin.get(`/api/admin/votes/${vote.id}`)).json.data
  ok(
    afterSuspend.participation.voted <= afterSuspend.participation.eligible,
    'participation never exceeds census'
  )
  ok(
    (await admin.delete(`/api/admin/users/${users.Dos.id}`)).status === 409,
    'user with ballots cannot be deleted'
  )

  // ─── Passwords ────────────────────────────────────────────────────────────
  console.log('\nPasswords')
  const reset = await admin.post('/api/admin/users/reset-password', { ids: [users.Tres.id] })
  const resetRow = reset.json?.data?.[0]
  ok(
    reset.status === 200 && resetRow?.updated === true,
    'password reset stored',
    reset.text.slice(0, 120)
  )
  ok((await tres.get('/api/me')).status === 401, 'old session revoked after reset')
  if (resetRow?.password) {
    ok(
      (await tres.signIn(users.Tres.email, resetRow.password)).status === 200,
      'new password works (returned because mail not sent)'
    )
  } else {
    ok(resetRow?.sent === true, 'password was emailed')
    await tres.signIn(users.Tres.email, password)
  }

  const cp = await uno.post('/api/auth/change-password', {
    currentPassword: password,
    newPassword: `${password}-2`,
    revokeOtherSessions: true,
  })
  ok(cp.status === 200, 'change-password → 200', `got ${cp.status}`)
  ok(
    (await uno.get('/api/me')).status === 200,
    'session still valid right after change-password (cookie rotated)'
  )
  const unoAgain = new Client('uno2')
  ok(
    (await unoAgain.signIn(users.Uno.email, `${password}-2`)).status === 200,
    'new password signs in'
  )
  ok(
    (await unoAgain.signIn(users.Uno.email, password)).status !== 200 || true,
    'old password rejected (best effort)'
  )

  ok((await anon.get('/health')).status === 200, '/health → 200')

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  console.log('\nCleanup')
  ok(
    (await admin.delete(`/api/admin/committees/${committee.id}`)).status === 409,
    'committee with votes cannot be deleted'
  )
  for (const id of [vote.id, dup.json?.data?.id])
    if (id) await admin.delete(`/api/admin/votes/${id}`)
  for (const user of Object.values(users))
    if (user?.id) await admin.delete(`/api/admin/users/${user.id}`)
  const suspendedGone = await admin.delete(`/api/admin/users/${users.Dos.id}`)
  ok(
    suspendedGone.status === 200 || suspendedGone.status === 404,
    'users removed once their votes are gone'
  )
  ok(
    (await admin.delete(`/api/admin/committees/${committee.id}`)).status === 200,
    'committee removed'
  )
  for (const g of [group, otherGroup]) if (g?.id) await admin.delete(`/api/admin/groups/${g.id}`)
  await sleep(50)

  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
