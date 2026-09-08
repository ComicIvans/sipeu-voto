import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

const cuid = () => createId()

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
}

// ─── Committees & Parliamentary Groups ───────────────────────────────────────

export const committees = pgTable(
  'committees',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** Public path of the 16:9 cover image, or null to fall back to the icon. */
    cover: text('cover'),
    /**
     * Lucide name without the `i-lucide-` prefix, from `COMMITTEE_ICONS`. Unlike
     * the cover, this one is shown even where there is no room for a picture,
     * such as the committee badge next to a person's name.
     */
    icon: text('icon'),
    order: integer('order').default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_committees_slug_unique').on(table.slug)]
)

export const parliamentaryGroups = pgTable(
  'parliamentary_groups',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    name: text('name').notNull(),
    abbreviation: text('abbreviation').notNull(),
    color: text('color').default('#0048a0').notNull(),
    /** Public path of the logo, or null to fall back to the icon. */
    logo: text('logo'),
    /** Lucide name without the `i-lucide-` prefix, from `GROUP_ICONS`. */
    icon: text('icon'),
    order: integer('order').default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_groups_abbreviation_unique').on(table.abbreviation)]
)

/**
 * Small key/value store for the handful of settings that belong to no row. The
 * plenary is the case that forced it: it has no `committees` record, its id is
 * null throughout the API, and its cover still has to be editable by admins.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...timestamps,
})

// ─── Users (Better Auth + app fields) ────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    firstName: text('first_name').default('').notNull(),
    lastName: text('last_name').default('').notNull(),
    role: text('role').default('delegate').notNull(),
    banned: boolean('banned').default(false).notNull(),
    banReason: text('ban_reason'),
    banExpires: timestamp('ban_expires', { withTimezone: true, mode: 'date' }),
    committeeId: text('committee_id').references(() => committees.id, { onDelete: 'set null' }),
    groupId: text('group_id').references(() => parliamentaryGroups.id, { onDelete: 'set null' }),
    photoRemovedAt: timestamp('photo_removed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('idx_users_committee_id').on(table.committeeId),
    index('idx_users_group_id').on(table.groupId),
    index('idx_users_role').on(table.role),
  ]
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    impersonatedBy: text('impersonated_by'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    index('idx_sessions_user_id').on(table.userId),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ]
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (table) => [index('idx_accounts_user_id').on(table.userId)]
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [index('idx_verifications_expires_at').on(table.expiresAt)]
)

// ─── Votes ───────────────────────────────────────────────────────────────────

export const votes = pgTable(
  'votes',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    // NULL means plenary: every delegate with a committee can vote.
    committeeId: text('committee_id').references(() => committees.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    visible: boolean('visible').default(true).notNull(),
    open: boolean('open').default(false).notNull(),
    allowChange: boolean('allow_change').default(false).notNull(),
    showLiveResults: boolean('show_live_results').default(true).notNull(),
    /** When it actually opened and closed, not what was planned. */
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
    /**
     * Optional schedule. Both are hints for the ticker in
     * `server/plugins/voteSchedule.ts`, never the source of truth for whether a
     * vote is open: `open` is. A schedule that has already fired, or that an
     * admin overtook by hand, is cleared.
     */
    opensAt: timestamp('opens_at', { withTimezone: true, mode: 'date' }),
    closesAt: timestamp('closes_at', { withTimezone: true, mode: 'date' }),
    order: integer('order').default(0).notNull(),
    minimumVotes: integer('minimum_votes'),
    maxWinners: integer('max_winners'),
    ...timestamps,
  },
  (table) => [
    index('idx_votes_committee_id').on(table.committeeId),
    index('idx_votes_open').on(table.open),
    check(
      'votes_minimum_votes_positive',
      sql`${table.minimumVotes} IS NULL OR ${table.minimumVotes} > 0`
    ),
    check(
      'votes_max_winners_positive',
      sql`${table.maxWinners} IS NULL OR ${table.maxWinners} > 0`
    ),
    check(
      'votes_schedule_ordered',
      sql`${table.opensAt} IS NULL OR ${table.closesAt} IS NULL OR ${table.closesAt} > ${table.opensAt}`
    ),
  ]
)

export const voteOptions = pgTable(
  'vote_options',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    voteId: text('vote_id')
      .notNull()
      .references(() => votes.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color'),
    order: integer('order').default(0).notNull(),
    canWin: boolean('can_win').default(true).notNull(),
    ...timestamps,
  },
  (table) => [index('idx_vote_options_vote_id').on(table.voteId)]
)

export const ballots = pgTable(
  'ballots',
  {
    id: text('id').primaryKey().$defaultFn(cuid),
    voteId: text('vote_id')
      .notNull()
      .references(() => votes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    optionId: text('option_id')
      .notNull()
      .references(() => voteOptions.id, { onDelete: 'cascade' }),
    // Snapshot of the voter's affiliation when the ballot was cast, so later
    // admin corrections do not rewrite closed results. `restrict` keeps that
    // history readable: a group or committee referenced by a ballot cannot be
    // deleted, and a NULL here means "voted without one", never "look it up".
    groupId: text('group_id').references(() => parliamentaryGroups.id, { onDelete: 'restrict' }),
    committeeId: text('committee_id').references(() => committees.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_ballots_vote_user_unique').on(table.voteId, table.userId),
    index('idx_ballots_option_id').on(table.optionId),
    index('idx_ballots_group_id').on(table.groupId),
    index('idx_ballots_committee_id').on(table.committeeId),
  ]
)

// ─── Relations ───────────────────────────────────────────────────────────────

export const committeesRelations = relations(committees, ({ many }) => ({
  members: many(users),
  votes: many(votes),
}))

export const parliamentaryGroupsRelations = relations(parliamentaryGroups, ({ many }) => ({
  members: many(users),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  committee: one(committees, { fields: [users.committeeId], references: [committees.id] }),
  group: one(parliamentaryGroups, {
    fields: [users.groupId],
    references: [parliamentaryGroups.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  ballots: many(ballots),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const votesRelations = relations(votes, ({ one, many }) => ({
  committee: one(committees, { fields: [votes.committeeId], references: [committees.id] }),
  options: many(voteOptions),
  ballots: many(ballots),
}))

export const voteOptionsRelations = relations(voteOptions, ({ one, many }) => ({
  vote: one(votes, { fields: [voteOptions.voteId], references: [votes.id] }),
  ballots: many(ballots),
}))

export const ballotsRelations = relations(ballots, ({ one }) => ({
  vote: one(votes, { fields: [ballots.voteId], references: [votes.id] }),
  user: one(users, { fields: [ballots.userId], references: [users.id] }),
  option: one(voteOptions, { fields: [ballots.optionId], references: [voteOptions.id] }),
  group: one(parliamentaryGroups, {
    fields: [ballots.groupId],
    references: [parliamentaryGroups.id],
  }),
  committee: one(committees, { fields: [ballots.committeeId], references: [committees.id] }),
}))
