#!/usr/bin/env node
/**
 * End-to-end smoke test against a running server (dev or production build).
 *
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/smoke.mjs
 *
 * Creates its own committee, group, users and votes (prefixed "smoke-"), checks
 * authorisation, voting rules, concurrency and password flows, then deletes
 * what it created. Fixtures are removed even when an assertion throws.
 *
 * Two checks need a second database connection to force an interleaving that
 * HTTP alone cannot reproduce. They run only against a local server, reusing
 * DATABASE_URL, and are skipped otherwise.
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

/**
 * Two interleavings that HTTP requests alone cannot force. A second connection
 * to the same database holds the exact lock a mid-flight transaction would
 * hold, so the ordering is deterministic instead of hopeful. Only meaningful
 * when the server under test uses this DATABASE_URL, hence the localhost gate.
 */
const DB_URL =
  BASE.startsWith('http://localhost') || BASE.startsWith('http://127.')
    ? process.env.DATABASE_URL
    : null

async function withDbClient(fn) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function concurrencyChecks({ admin, committee, group, password }) {
  console.log('\nConcurrency (second database connection)')
  if (!DB_URL) {
    console.log('  – skipped: set DATABASE_URL and run against a local server')
    return
  }

  const raceUser = (
    await admin.post('/api/admin/users', {
      firstName: 'Carrera',
      lastName: `Smoke ${RUN}`,
      email: `smoke-race-${RUN}@example.com`,
      role: 'delegate',
      committeeId: committee.id,
      groupId: group.id,
      password,
      sendCredentials: false,
    })
  ).json?.data
  const raceVote = (
    await admin.post('/api/admin/votes', {
      name: `Smoke race ${RUN}`,
      committeeId: committee.id,
      options: [{ label: 'Sí' }, { label: 'No' }],
    })
  ).json?.data
  await admin.post(`/api/admin/votes/${raceVote.id}/open`)

  await withDbClient(async (pgClient) => {
    // Exactly what the ballot endpoint holds between locking the voter and
    // committing their ballot.
    await pgClient.query('BEGIN')
    await pgClient.query('SELECT id FROM users WHERE id = $1 FOR SHARE', [raceUser.id])

    let settled = false
    const deletion = admin.delete(`/api/admin/users/${raceUser.id}`).then((res) => {
      settled = true
      return res
    })
    await sleep(800)
    ok(!settled, 'deleting a user waits for the ballot transaction that holds the row')

    await pgClient.query(
      'INSERT INTO ballots (id, vote_id, user_id, option_id, group_id, committee_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        `smokeballot${RUN}`,
        raceVote.id,
        raceUser.id,
        raceVote.options[0].id,
        group.id,
        committee.id,
      ]
    )
    await pgClient.query('COMMIT')

    const res = await deletion
    ok(res.status === 409, 'delete is refused once that ballot is committed', `got ${res.status}`)
  })

  const raceView = (await admin.get(`/api/admin/votes/${raceVote.id}`)).json.data
  ok(
    raceView.participation.voted === 1,
    'the ballot cast during the delete attempt survived',
    `voted=${raceView.participation.voted}`
  )

  // Import rollback: a row that cannot be created must undo the rows before it.
  const survivorEmail = `smoke-survivor-${RUN}@example.com`
  const collideEmail = `smoke-collide-${RUN}@example.com`
  await withDbClient(async (pgClient) => {
    // Uncommitted, so the import's pre-check sees no conflict, but the unique
    // index already reserves the address: the insert will block, then fail.
    await pgClient.query('BEGIN')
    await pgClient.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [
      `smokecollide${RUN}`,
      'Colisión Smoke',
      collideEmail,
    ])

    const csv = [
      'nombre,apellidos,email,comision,grupo,rol',
      `Superviviente,Smoke ${RUN},${survivorEmail},,,admin`,
      `Colision,Smoke ${RUN},${collideEmail},,,admin`,
    ].join('\n')
    const form = new FormData()
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'smoke.csv')
    form.append('sendCredentials', 'false')

    let settled = false
    const importing = admin.request('POST', '/api/admin/users/import', { form }).then((res) => {
      settled = true
      return res
    })
    await sleep(800)
    ok(!settled, 'import waits on the address reserved by the other transaction')

    await pgClient.query('COMMIT')
    const res = await importing
    ok(
      res.status >= 400,
      'import fails when one of its rows cannot be created',
      `got ${res.status}`
    )
  })

  await withDbClient(async (pgClient) => {
    const { rows } = await pgClient.query('SELECT email FROM users WHERE email = ANY($1)', [
      [survivorEmail, collideEmail],
    ])
    const emails = rows.map((row) => row.email)
    ok(
      !emails.includes(survivorEmail),
      'the row before the failing one was rolled back',
      emails.join(',')
    )
    await pgClient.query('DELETE FROM users WHERE email = ANY($1)', [[survivorEmail, collideEmail]])
  })

  await admin.delete(`/api/admin/votes/${raceVote.id}`)
  const raceUserGone = await admin.delete(`/api/admin/users/${raceUser.id}`)
  ok(
    raceUserGone.status === 200,
    'race fixtures removed once their vote is gone',
    `got ${raceUserGone.status}`
  )
}

async function main() {
  console.log(`Smoke test against ${BASE} (run ${RUN})`)
  const anon = new Client('anon')
  const admin = new Client('admin')

  // Declared here so the cleanup in `finally` can reach them whatever fails.
  const users = {}
  let committee = null
  let group = null
  let otherGroup = null
  let vote = null
  let tieVote = null
  let dupId = null

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

  try {
    // ─── Fixtures ─────────────────────────────────────────────────────────────
    console.log('\nFixtures')
    committee = (
      await admin.post('/api/admin/committees', { name: `smoke-${RUN}`, slug: `smoke-${RUN}` })
    ).json?.data
    ok(Boolean(committee?.id), 'committee created')
    const reserved = await admin.post('/api/admin/committees', {
      name: 'Pleno falso',
      slug: 'pleno',
    })
    ok(reserved.status === 400, 'slug "pleno" is reserved', `got ${reserved.status}`)

    group = (
      await admin.post('/api/admin/groups', {
        name: `Smoke ${RUN}`,
        abbreviation: `SM${RUN.slice(0, 3)}`,
        color: '#123456',
      })
    ).json?.data
    ok(Boolean(group?.id), 'group created')

    const password = `Smoke-${RUN}-pass`
    for (const first of ['Uno', 'Dos', 'Tres', 'Cuatro']) {
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
    const cuatro = new Client('cuatro')
    ok((await uno.signIn(users.Uno.email, password)).status === 200, 'delegate signs in')
    ok((await dos.signIn(users.Dos.email, password)).status === 200, 'second delegate signs in')
    ok((await tres.signIn(users.Tres.email, password)).status === 200, 'third delegate signs in')
    ok(
      (await cuatro.signIn(users.Cuatro.email, password)).status === 200,
      'fourth delegate signs in'
    )
    ok(
      (await outsider.signIn(users.Fuera.email, password)).status === 200,
      'outsider admin signs in'
    )
    ok((await uno.get('/api/admin/stats')).status === 403, 'delegate GET /api/admin/stats → 403')

    // ─── Vote lifecycle ───────────────────────────────────────────────────────
    console.log('\nVote lifecycle')
    const voteRes = await admin.post('/api/admin/votes', {
      name: `Smoke vote ${RUN}`,
      committeeId: committee.id,
      showLiveResults: false,
      options: [
        { label: 'A favor' },
        { label: 'En contra' },
        { label: 'Abstención', canWin: false },
      ],
    })
    ok(voteRes.status === 200, 'vote created')
    vote = voteRes.json.data
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
      statuses.filter((s) => s === 200).length >= 1 &&
        statuses.every((s) => s === 200 || s === 409),
      'concurrent double submit settles as 200/409 only',
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
      publicView.participation.voted === 2 && publicView.participation.eligible === 4,
      'public participation 2/4'
    )

    const lockedPatch = await admin.patch(`/api/admin/votes/${vote.id}`, { allowChange: true })
    ok(
      lockedPatch.status === 409,
      'conditions cannot change while open',
      `got ${lockedPatch.status}`
    )
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
    // Only two outcomes are acceptable: the ballot committed before the close
    // (200, counted) or after it (409, not counted). Anything else is a bug.
    ok(
      lateRes.status === 200 || lateRes.status === 409,
      'late ballot resolves as accepted or refused',
      `got ${lateRes.status} ${lateRes.text.slice(0, 120)}`
    )
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
    // Which option Dos ended up on depends on the burst above, so assert the
    // outcome against the counts instead of a fixed winner.
    const countOf = (id) => afterClose.totals.find((total) => total.optionId === id)?.count ?? 0
    ok(
      afterClose.status === 'closed' &&
        (countOf(favor) > countOf(contra)
          ? afterClose.winnerIds.includes(favor) && afterClose.tiedOptionIds.length === 0
          : afterClose.winnerIds.length === 0 && afterClose.tiedOptionIds.includes(favor)),
      'closed vote resolves as a winner or as a tie, matching the counts',
      `favor=${countOf(favor)} contra=${countOf(contra)} winners=${afterClose.winnerIds} tied=${afterClose.tiedOptionIds}`
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
      options: vote.options.map((o) => ({
        id: o.id,
        label: o.label,
        color: o.color,
        canWin: true,
      })),
    })
    ok(meaning.status === 409, 'option meaning frozen after ballots', `got ${meaning.status}`)

    const dup = await admin.post(`/api/admin/votes/${vote.id}/duplicate`)
    dupId = dup.json?.data?.id ?? null
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

    // ─── Tie at the cut ───────────────────────────────────────────────────────
    console.log('\nTie at the cut')
    const tieRes = await admin.post('/api/admin/votes', {
      name: `Smoke tie ${RUN}`,
      committeeId: committee.id,
      maxWinners: 2,
      options: [{ label: 'Alfa' }, { label: 'Beta' }, { label: 'Gamma' }],
    })
    ok(tieRes.status === 200, 'tie vote created', `got ${tieRes.status}`)
    tieVote = tieRes.json.data
    const [alfa, beta, gamma] = tieVote.options.map((o) => o.id)
    ok((await admin.post(`/api/admin/votes/${tieVote.id}/open`)).status === 200, 'tie vote opened')

    // Alfa 2, Beta 1, Gamma 1 with two seats: Alfa is elected, Beta and Gamma
    // dispute the seat that is left.
    for (const [client, optionId] of [
      [uno, alfa],
      [cuatro, alfa],
      [dos, beta],
      [tres, gamma],
    ]) {
      const res = await client.post(`/api/me/votes/${tieVote.id}/ballot`, { optionId })
      ok(res.status === 200, `tie ballot cast (${client.name})`, `got ${res.status}`)
    }
    ok((await admin.post(`/api/admin/votes/${tieVote.id}/close`)).status === 200, 'tie vote closed')

    const tieView = (await anon.get(`/api/votes/${tieVote.id}`)).json.data
    ok(
      tieView.winnerIds.length === 1 && tieView.winnerIds[0] === alfa,
      'only Alfa wins a seat',
      [...tieView.winnerIds].join(',')
    )
    ok(
      tieView.tie === true &&
        [...tieView.tiedOptionIds].sort().join(',') === [beta, gamma].sort().join(','),
      'Beta and Gamma are reported as tied',
      `tie=${tieView.tie} tied=${tieView.tiedOptionIds.join(',')}`
    )
    const tieCsv = await admin.get(`/api/admin/votes/${tieVote.id}/export`)
    const csvOptionRows = tieCsv.text.split('\n')
    const rowFor = (label) => csvOptionRows.find((line) => line.startsWith(`${label},`)) ?? ''
    ok(rowFor('Alfa').endsWith('sí,no'), 'CSV marks Alfa as winner, not tied', rowFor('Alfa'))
    ok(rowFor('Beta').endsWith('no,sí'), 'CSV marks Beta as tied, not winner', rowFor('Beta'))
    ok(
      tieCsv.text.includes('Empate pendiente de resolver'),
      'CSV reports the unresolved tie in its metadata'
    )

    ok(
      (await admin.delete(`/api/admin/groups/${group.id}`)).status === 409,
      'group referenced by a ballot cannot be deleted'
    )

    // Snapshot: moving a voter to another group keeps the closed result.
    otherGroup = (
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
    const staleLogin = await unoAgain.signIn(users.Uno.email, password)
    ok(staleLogin.status === 401, 'old password rejected', `got ${staleLogin.status}`)

    ok((await anon.get('/health')).status === 200, '/health → 200')

    await concurrencyChecks({ admin, committee, group, password })
  } finally {
    // ─── Cleanup ────────────────────────────────────────────────────────────
    // Runs even when an assertion above throws, so a failed run leaves no
    // half-built committee behind for the next one.
    console.log('\nCleanup')
    if (committee && vote) {
      ok(
        (await admin.delete(`/api/admin/committees/${committee.id}`)).status === 409,
        'committee with votes cannot be deleted'
      )
    }
    for (const id of [vote?.id, tieVote?.id, dupId]) {
      if (!id) continue
      const res = await admin.delete(`/api/admin/votes/${id}`)
      ok(res.status === 200 || res.status === 404, `vote ${id} removed`, `got ${res.status}`)
    }
    for (const user of Object.values(users)) {
      if (!user?.id) continue
      const res = await admin.delete(`/api/admin/users/${user.id}`)
      ok(
        res.status === 200 || res.status === 404,
        `user ${user.email} removed once their votes are gone`,
        `got ${res.status} ${res.text.slice(0, 120)}`
      )
    }
    if (committee) {
      const res = await admin.delete(`/api/admin/committees/${committee.id}`)
      ok(res.status === 200 || res.status === 404, 'committee removed', `got ${res.status}`)
    }
    for (const g of [group, otherGroup]) {
      if (!g?.id) continue
      const res = await admin.delete(`/api/admin/groups/${g.id}`)
      ok(
        res.status === 200 || res.status === 404,
        `group ${g.abbreviation} removed`,
        `got ${res.status}`
      )
    }
    await sleep(50)
  }
}

main()
  .then(() => {
    console.log(`\n${passes} passed, ${failures} failed`)
    process.exit(failures > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
