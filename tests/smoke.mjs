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
/**
 * Matched on the parsed hostname, never on a prefix: `http://localhost.example.com`
 * starts with `http://localhost` and is somebody else's server. This gate opens
 * a direct database connection and, further down, the only writes that touch
 * state the script did not create.
 */
const IS_LOCAL_TARGET = (() => {
  try {
    const { hostname } = new URL(BASE)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
})()

const DB_URL = IS_LOCAL_TARGET ? process.env.DATABASE_URL : null

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

/**
 * Waits until PostgreSQL reports somebody waiting on *this* transaction.
 * "The request has not answered yet" alone would also be true of a slow server
 * that never reached the lock. Asking about our own transaction id, rather than
 * scanning backends, cannot be satisfied by unrelated traffic and does not
 * depend on how a pooled backend reports its current statement.
 */
async function waitForWaitersOnOurTransaction(pgClient, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  let waiters = 0
  while (Date.now() < deadline) {
    const { rows } = await pgClient.query(
      `SELECT count(*)::int AS waiters
         FROM pg_locks
        WHERE locktype = 'transactionid'
          AND NOT granted
          AND transactionid = pg_current_xact_id()::xid`
    )
    waiters = rows[0]?.waiters ?? 0
    if (waiters > 0) break
    await sleep(100)
  }
  ok(waiters > 0, label, waiters > 0 ? '' : 'nothing ended up waiting on this transaction')
  return waiters
}

async function concurrencyChecks({ admin, committee, group, password, track }) {
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
  track.user('Carrera', raceUser)
  const raceVote = (
    await admin.post('/api/admin/votes', {
      name: `Smoke race ${RUN}`,
      committeeId: committee.id,
      options: [{ label: 'Sí' }, { label: 'No' }],
    })
  ).json?.data
  track.vote(raceVote?.id)
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
    await waitForWaitersOnOurTransaction(
      pgClient,
      'deleting a user blocks on the row the ballot transaction holds'
    )
    ok(!settled, 'the delete request is still waiting at that point')

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
  track.email(survivorEmail)
  track.email(collideEmail)
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
    await waitForWaitersOnOurTransaction(
      pgClient,
      'the import blocks on the address reserved by the other transaction'
    )
    ok(!settled, 'the import request is still waiting at that point')

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
  })
}

/**
 * Test images are generated rather than committed: the checks care about the
 * shape that comes back out, not about any particular picture.
 */
async function makeImage({ width, height, alpha = false, format = 'png' }) {
  const { default: sharp } = await import('sharp')
  const background = alpha ? { r: 255, g: 204, b: 0, alpha: 0 } : '#0b3d91'
  const image = sharp({ create: { width, height, channels: alpha ? 4 : 3, background } })
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer()
}

/**
 * A picture stored one way round and displayed the other, which is what a phone
 * held sideways produces. Orientation 6 means "rotate 90° clockwise to view".
 */
async function makeTurnedImage({ width, height }) {
  const { default: sharp } = await import('sharp')
  return sharp({ create: { width, height, channels: 3, background: '#0b3d91' } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer()
}

async function imageSize(url) {
  const { default: sharp } = await import('sharp')
  const response = await fetch(`${BASE}${url}`)
  if (!response.ok) return null
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
  return { width: meta.width, height: meta.height, alpha: meta.hasAlpha }
}

function imageForm(buffer, filename, type) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type }), filename)
  return form
}

async function imageChecks({ admin, anon, committee, group }) {
  console.log('\nImages')

  const wideLogo = await makeImage({ width: 600, height: 200, alpha: true })
  const logoRes = await admin.request('POST', `/api/admin/groups/${group.id}/logo`, {
    form: imageForm(wideLogo, 'logo.png', 'image/png'),
  })
  ok(logoRes.status === 200, 'group logo uploaded', `got ${logoRes.status}`)
  const logoUrl = logoRes.json?.data?.logo
  const logoMeta = await imageSize(logoUrl)
  ok(
    logoMeta?.width === 512 && logoMeta?.height === 171,
    'a landscape logo keeps its shape instead of being cropped',
    JSON.stringify(logoMeta)
  )
  ok(logoMeta?.alpha === true, 'the logo keeps its transparency')

  // Replacing must hand out a new URL and drop the file it displaced.
  const replaced = await admin.request('POST', `/api/admin/groups/${group.id}/logo`, {
    form: imageForm(
      await makeImage({ width: 300, height: 300, alpha: true }),
      'l2.png',
      'image/png'
    ),
  })
  const secondUrl = replaced.json?.data?.logo
  ok(secondUrl && secondUrl !== logoUrl, 'replacing a logo hands out a different URL')
  ok((await anon.get(logoUrl)).status === 404, 'the file it replaced is gone')
  ok((await anon.get(secondUrl)).status === 200, 'the new file is served')

  const groupsList = (await admin.get('/api/admin/groups')).json.data
  ok(
    groupsList.find((row) => row.id === group.id)?.logo === secondUrl,
    'the group carries its logo through the API'
  )

  for (const [label, buffer, filename, type] of [
    [
      'a portrait cover',
      await makeImage({ width: 900, height: 1600, format: 'jpeg' }),
      'p.jpg',
      'image/jpeg',
    ],
    [
      'a panoramic cover',
      await makeImage({ width: 3000, height: 1000, format: 'jpeg' }),
      'w.jpg',
      'image/jpeg',
    ],
    // Stored 450x800, shown 800x450: it clears the minimum only if the check
    // reads the orientation the way the resize does.
    ['a sideways cover', await makeTurnedImage({ width: 450, height: 800 }), 'e.jpg', 'image/jpeg'],
  ]) {
    const res = await admin.request('POST', `/api/admin/committees/${committee.id}/cover`, {
      form: imageForm(buffer, filename, type),
    })
    ok(res.status === 200, `${label} is accepted`, `got ${res.status}`)
    const meta = await imageSize(res.json?.data?.cover)
    ok(
      meta?.width === 1600 && meta?.height === 900,
      `${label} is cropped to 16:9`,
      JSON.stringify(meta)
    )
  }

  const rejected = [
    [
      'too small',
      await makeImage({ width: 400, height: 300, format: 'jpeg' }),
      'small.jpg',
      'image/jpeg',
    ],
    ['corrupt', Buffer.from('this is not an image'), 'broken.png', 'image/png'],
    [
      'an SVG renamed to .png',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"></svg>'),
      'fake.png',
      'image/png',
    ],
    ['over the size limit', Buffer.alloc(9 * 1024 * 1024), 'huge.png', 'image/png'],
    // Stored 800x450, shown 450x800: the stored numbers clear the minimum and
    // the ones people would see do not.
    [
      'a sideways cover that is short once turned',
      await makeTurnedImage({ width: 800, height: 450 }),
      'e2.jpg',
      'image/jpeg',
    ],
  ]
  for (const [label, buffer, filename, type] of rejected) {
    const res = await admin.request('POST', `/api/admin/committees/${committee.id}/cover`, {
      form: imageForm(buffer, filename, type),
    })
    ok(res.status === 400, `${label} is refused`, `got ${res.status}`)
  }

  const missing = await admin.request('POST', '/api/admin/groups/does-not-exist/logo', {
    form: imageForm(await makeImage({ width: 300, height: 300 }), 'l.png', 'image/png'),
  })
  ok(missing.status === 404, 'uploading to a group that is gone → 404', `got ${missing.status}`)

  // A delete refused because of members or ballots must leave the image alone.
  const refused = await admin.delete(`/api/admin/groups/${group.id}`)
  ok(refused.status === 409, 'group with members cannot be deleted', `got ${refused.status}`)
  ok((await anon.get(secondUrl)).status === 200, 'a refused delete keeps the logo')

  // Admin-uploaded profile photos. On its own user: uploading over a seeded
  // account would replace a real person's photo, and against the VPS that is
  // not recoverable.
  const subject = (
    await admin.post('/api/admin/users', {
      firstName: 'Foto',
      lastName: `Smoke ${RUN}`,
      email: `smoke-foto-${RUN}@example.com`,
      role: 'delegate',
      committeeId: committee.id,
      groupId: group.id,
      password: `Smoke-${RUN}-pass`,
      sendCredentials: false,
    })
  ).json?.data
  ok(Boolean(subject?.id), 'user for the avatar checks created')

  const avatarRes = await admin.request('POST', `/api/admin/users/${subject.id}/avatar`, {
    form: imageForm(
      await makeImage({ width: 900, height: 1200, format: 'jpeg' }),
      'face.jpg',
      'image/jpeg'
    ),
  })
  ok(avatarRes.status === 200, 'admin uploads a photo for someone else', `got ${avatarRes.status}`)
  const avatarUrl = avatarRes.json?.data?.image
  const avatarMeta = await imageSize(avatarUrl)
  ok(
    avatarMeta?.width === 512 && avatarMeta?.height === 512,
    'a portrait photo is cropped to a square',
    JSON.stringify(avatarMeta)
  )

  const listedUser = (await admin.get('/api/admin/users')).json?.data?.find(
    (row) => row.id === subject.id
  )
  ok(listedUser?.image === avatarUrl, 'the photo reaches the user listing')

  const replacedAvatar = await admin.request('POST', `/api/admin/users/${subject.id}/avatar`, {
    form: imageForm(
      await makeImage({ width: 600, height: 600, format: 'jpeg' }),
      'face2.jpg',
      'image/jpeg'
    ),
  })
  const secondAvatar = replacedAvatar.json?.data?.image
  ok(secondAvatar && secondAvatar !== avatarUrl, 'replacing a photo hands out a different URL')
  ok((await anon.get(avatarUrl)).status === 404, 'the photo it replaced is gone')

  const removed = await admin.delete(`/api/admin/users/${subject.id}/avatar`)
  ok(removed.status === 200, 'admin removes the photo', `got ${removed.status}`)
  ok(removed.json?.data?.image === null, 'the user comes back without a photo')
  ok(
    Boolean(removed.json?.data?.photoRemovedAt),
    'and is marked so the profile page asks for a new one'
  )
  ok((await anon.get(secondAvatar)).status === 404, 'the removed photo file is gone')

  const restored = await admin.request('POST', `/api/admin/users/${subject.id}/avatar`, {
    form: imageForm(await makeImage({ width: 300, height: 300 }), 'face3.png', 'image/png'),
  })
  ok(
    restored.json?.data?.photoRemovedAt === null,
    'uploading again retires that mark',
    JSON.stringify(restored.json?.data?.photoRemovedAt)
  )

  const tooSmallFace = await admin.request('POST', `/api/admin/users/${subject.id}/avatar`, {
    form: imageForm(await makeImage({ width: 40, height: 40 }), 'tiny.png', 'image/png'),
  })
  ok(tooSmallFace.status === 400, 'a 40px photo is refused', `got ${tooSmallFace.status}`)

  const missingUser = await admin.request('POST', '/api/admin/users/does-not-exist/avatar', {
    form: imageForm(await makeImage({ width: 300, height: 300 }), 'f.png', 'image/png'),
  })
  ok(
    missingUser.status === 404,
    'uploading to a user that is gone → 404',
    `got ${missingUser.status}`
  )

  const lastAvatar = restored.json?.data?.image
  ok(
    (await admin.delete(`/api/admin/users/${subject.id}`)).status === 200,
    'the avatar fixture user is deleted'
  )
  ok((await anon.get(lastAvatar)).status === 404, 'deleting the user takes their photo with it')

  // The plenary cover is global state, not a fixture this script created:
  // removing it at the end would destroy the real one. Only exercised against a
  // local server and only while the slot is empty.
  const existingPlenary = (await anon.get('/api/committees')).json.data.plenary.cover
  if (!DB_URL || existingPlenary) {
    console.log('  – plenary cover skipped: only local, and only when no cover is set')
    return
  }

  const plenary = await admin.request('POST', '/api/admin/plenary/cover', {
    form: imageForm(
      await makeImage({ width: 1920, height: 1080, format: 'jpeg' }),
      'pl.jpg',
      'image/jpeg'
    ),
  })
  ok(plenary.status === 200, 'plenary cover uploaded', `got ${plenary.status}`)
  const plenaryUrl = plenary.json?.data?.cover
  const listed = (await anon.get('/api/committees')).json.data
  ok(listed.plenary.cover === plenaryUrl, 'the plenary cover reaches the public listing')
  ok(
    (await anon.get('/api/committees/pleno')).json.data.cover === plenaryUrl,
    'and the plenary detail'
  )
  ok((await admin.delete('/api/admin/plenary/cover')).status === 200, 'plenary cover removed')
  ok((await anon.get(plenaryUrl)).status === 404, 'its file is gone too')
  ok(
    (await anon.get('/api/committees')).json.data.plenary.cover === null,
    'and the listing falls back to no cover'
  )
}

async function main() {
  console.log(`Smoke test against ${BASE} (run ${RUN})`)
  const anon = new Client('anon')
  const admin = new Client('admin')

  // Declared here so the cleanup in `finally` can reach them whatever fails.
  const users = {}
  let committee = null
  let plenaryCommittee = null
  let group = null
  let otherGroup = null
  let vote = null
  let tieVote = null
  let plenaryVote = null
  const extraVoteIds = []
  const strayEmails = []
  const track = {
    user: (key, value) => {
      users[key] = value
    },
    vote: (id) => {
      if (id) extraVoteIds.push(id)
    },
    email: (email) => strayEmails.push(email),
  }
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

    // The admin form always resubmits `visible`; an unchanged value must not
    // be mistaken for an attempt to hide an open vote.
    const openRename = await admin.patch(`/api/admin/votes/${vote.id}`, {
      name: `Smoke vote ${RUN} (abierta)`,
      visible: true,
    })
    ok(openRename.status === 200, 'open vote can still be renamed', `got ${openRename.status}`)
    const hideOpen = await admin.patch(`/api/admin/votes/${vote.id}`, { visible: false })
    ok(hideOpen.status === 409, 'an open vote cannot be hidden', `got ${hideOpen.status}`)

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

    // ─── Plenary ballots and their committee ────────────────────────────────
    console.log('\nPlenary ballots')
    plenaryCommittee = (
      await admin.post('/api/admin/committees', {
        name: `smoke-pleno-${RUN}`,
        slug: `smoke-pleno-${RUN}`,
      })
    ).json?.data
    ok(Boolean(plenaryCommittee?.id), 'second committee created')
    const plenUser = (
      await admin.post('/api/admin/users', {
        firstName: 'Plenaria',
        lastName: `Smoke ${RUN}`,
        email: `smoke-plen-${RUN}@example.com`,
        role: 'delegate',
        committeeId: plenaryCommittee.id,
        groupId: group.id,
        password,
        sendCredentials: false,
      })
    ).json?.data
    users.Plenaria = plenUser
    const plen = new Client('plenaria')
    ok((await plen.signIn(plenUser.email, password)).status === 200, 'plenary voter signs in')

    plenaryVote = (
      await admin.post('/api/admin/votes', {
        name: `Smoke plenary ${RUN}`,
        committeeId: null,
        options: [{ label: 'Sí' }, { label: 'No' }],
      })
    ).json?.data
    ok(
      (await admin.post(`/api/admin/votes/${plenaryVote.id}/open`)).status === 200,
      'plenary vote opened'
    )
    ok(
      (
        await plen.post(`/api/me/votes/${plenaryVote.id}/ballot`, {
          optionId: plenaryVote.options[0].id,
        })
      ).status === 200,
      'plenary ballot cast'
    )
    ok(
      (await admin.post(`/api/admin/votes/${plenaryVote.id}/close`)).status === 200,
      'plenary vote closed'
    )

    // The committee now has no members and no votes of its own, but a ballot
    // still records it as the affiliation its voter had.
    ok(
      (await admin.patch(`/api/admin/users/${plenUser.id}`, { committeeId: committee.id }))
        .status === 200,
      'plenary voter moved to the other committee'
    )
    const plenCommitteeDelete = await admin.delete(`/api/admin/committees/${plenaryCommittee.id}`)
    ok(
      plenCommitteeDelete.status === 409,
      'committee referenced by a plenary ballot cannot be deleted',
      `got ${plenCommitteeDelete.status} ${plenCommitteeDelete.text.slice(0, 120)}`
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

    // ─── Icons and ordering ───────────────────────────────────────────────────
    console.log('\nIcons and ordering')

    ok(
      (await admin.patch(`/api/admin/committees/${committee.id}`, { icon: 'scale' })).status ===
        200,
      'a committee icon from the list is accepted'
    )
    const withIcon = (await admin.get('/api/admin/committees')).json.data.find(
      (row) => row.id === committee.id
    )
    ok(
      withIcon?.icon === 'scale',
      'and comes back on the committee',
      JSON.stringify(withIcon?.icon)
    )
    ok(
      (await anon.get('/api/committees')).json.data.committees.find((c) => c.id === committee.id)
        ?.icon === 'scale',
      'and reaches the public listing'
    )
    ok(
      (await admin.patch(`/api/admin/committees/${committee.id}`, { icon: 'not-an-icon' }))
        .status === 400,
      'an icon outside the list is refused'
    )
    ok(
      (await admin.patch(`/api/admin/committees/${committee.id}`, { icon: null })).status === 200,
      'and it can go back to the default'
    )
    ok(
      (await admin.patch(`/api/admin/groups/${group.id}`, { icon: 'rose' })).status === 200,
      'a group icon from the list is accepted'
    )
    ok(
      (await admin.patch(`/api/admin/groups/${group.id}`, { icon: 'landmark' })).status === 400,
      'a committee icon is not a group icon'
    )

    // Ordering covers every row, including ones this script did not create, so
    // the original order is captured and put back before moving on.
    const originalOrder = (await admin.get('/api/admin/committees')).json.data.map((row) => row.id)
    ok(originalOrder.length >= 2, 'there are enough committees to reorder')

    ok(
      (await admin.post('/api/admin/committees/reorder', { ids: originalOrder.slice(1) }))
        .status === 400,
      'a partial ordering is refused'
    )
    ok(
      (
        await admin.post('/api/admin/committees/reorder', {
          ids: [originalOrder[0], ...originalOrder],
        })
      ).status === 400,
      'an ordering with a repeated row is refused'
    )

    const reversed = [...originalOrder].reverse()
    ok(
      (await admin.post('/api/admin/committees/reorder', { ids: reversed })).status === 200,
      'a full ordering is applied'
    )
    const afterReorder = (await admin.get('/api/admin/committees')).json.data.map((row) => row.id)
    ok(
      afterReorder.join(',') === reversed.join(','),
      'and the listing comes back in that order',
      afterReorder.join(',')
    )
    ok(
      (await admin.post('/api/admin/committees/reorder', { ids: originalOrder })).status === 200,
      'the original order is put back'
    )
    ok(
      (await admin.get('/api/admin/committees')).json.data.map((row) => row.id).join(',') ===
        originalOrder.join(','),
      'and it stuck'
    )

    const groupOrder = (await admin.get('/api/admin/groups')).json.data.map((row) => row.id)
    const groupsReversed = [...groupOrder].reverse()
    ok(
      (await admin.post('/api/admin/groups/reorder', { ids: groupsReversed })).status === 200,
      'groups reorder the same way'
    )
    ok(
      (await admin.post('/api/admin/groups/reorder', { ids: groupOrder })).status === 200,
      'and go back where they were'
    )
    ok(
      (await admin.get('/api/admin/groups')).json.data.map((row) => row.id).join(',') ===
        groupOrder.join(','),
      'confirmed'
    )

    // ─── Scheduled open and close ─────────────────────────────────────────────
    // The only check that proves the ticker in server/plugins/voteSchedule.ts is
    // actually running in the build under test. It waits on real time, so it is
    // the slowest part of this script.
    console.log('\nSchedule')

    const inSeconds = (seconds) => new Date(Date.now() + seconds * 1000).toISOString()

    async function waitForStatus(voteId, wanted, timeoutMs = 45000) {
      const deadline = Date.now() + timeoutMs
      let last = null
      while (Date.now() < deadline) {
        const res = await admin.get(`/api/admin/votes/${voteId}`)
        last = res.json?.data
        if (last?.status === wanted) return last
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      return last
    }

    const scheduled = (
      await admin.post('/api/admin/votes', {
        name: `Smoke schedule ${RUN}`,
        committeeId: committee.id,
        opensAt: inSeconds(3),
        options: [{ label: 'A favor' }, { label: 'En contra' }],
      })
    ).json?.data
    ok(Boolean(scheduled?.id), 'vote created with an opening time')
    track.vote(scheduled?.id)
    ok(scheduled?.status === 'pending', 'it stays pending until that time', scheduled?.status)
    ok(Boolean(scheduled?.opensAt), 'and the opening time reaches the API')

    const opened = await waitForStatus(scheduled.id, 'open')
    ok(opened?.status === 'open', 'the schedule opened it', `got ${opened?.status}`)
    ok(Boolean(opened?.startedAt), 'and recorded when that happened')
    ok(opened?.opensAt === null, 'the opening time is spent, not left to fire again')

    ok(
      (await admin.patch(`/api/admin/votes/${scheduled.id}`, { closesAt: inSeconds(3) })).status ===
        200,
      'a closing time can be set on an open vote'
    )
    const closed = await waitForStatus(scheduled.id, 'closed')
    ok(closed?.status === 'closed', 'the schedule closed it', `got ${closed?.status}`)
    ok(Boolean(closed?.endedAt), 'and recorded when that happened')
    ok(closed?.closesAt === null, 'the closing time is spent too')

    // Reopening by hand must not be undone by a time that has already gone by.
    ok(
      (await admin.patch(`/api/admin/votes/${scheduled.id}`, { closesAt: inSeconds(-3600) }))
        .status === 200,
      'a closing time in the past is accepted'
    )
    const reopened = (await admin.post(`/api/admin/votes/${scheduled.id}/open`)).json?.data
    ok(reopened?.open === true, 'reopening by hand works')
    ok(reopened?.closesAt === null, 'and discards the closing time it had already passed')
    ok((await admin.post(`/api/admin/votes/${scheduled.id}/close`)).status === 200, 'closed again')

    const badOrder = await admin.patch(`/api/admin/votes/${scheduled.id}`, {
      opensAt: inSeconds(600),
      closesAt: inSeconds(300),
    })
    ok(badOrder.status === 400, 'closing before opening → 400', `got ${badOrder.status}`)

    // A schedule says nothing about what a ballot means, so it stays editable.
    ok(
      (await admin.patch(`/api/admin/votes/${vote.id}`, { closesAt: inSeconds(3600) })).status ===
        200,
      'the schedule of a vote that already has ballots can still change'
    )
    ok(
      (await admin.patch(`/api/admin/votes/${vote.id}`, { closesAt: null })).status === 200,
      'and can be cleared again'
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

    await imageChecks({ admin, anon, committee, group })
    await concurrencyChecks({ admin, committee, group, password, track })
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
    for (const id of [vote?.id, tieVote?.id, plenaryVote?.id, dupId, ...extraVoteIds]) {
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
    for (const c of [committee, plenaryCommittee]) {
      if (!c?.id) continue
      const res = await admin.delete(`/api/admin/committees/${c.id}`)
      ok(
        res.status === 200 || res.status === 404,
        `committee ${c.slug} removed`,
        `got ${res.status}`
      )
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
    // Rows written straight to the database by the concurrency checks: the
    // admin API never learned about them, so they need removing by hand.
    if (DB_URL && strayEmails.length > 0) {
      await withDbClient(async (pgClient) => {
        await pgClient.query('DELETE FROM users WHERE email = ANY($1)', [strayEmails])
      })
      console.log(`  · ${strayEmails.length} row(s) written directly to the database removed`)
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
