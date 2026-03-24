import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  boolean,
  jsonb,
  integer,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const chainEnum = pgEnum("chain", ["ethereum", "base"]);
export const verdictEnum = pgEnum("verdict", [
  "low_risk",
  "caution",
  "high_risk",
]);
export const confidenceEnum = pgEnum("confidence", [
  "high",
  "medium",
  "low",
]);
export const planEnum = pgEnum("plan", ["free", "pro", "whale"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
]);
export const outcomeEnum = pgEnum("outcome", [
  "confirmed_rug",
  "survived",
  "dead",
  "pending",
]);

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Subscriptions ──────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: planEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Tokens ─────────────────────────────────────────────

export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: text("address").notNull(),
    chain: chainEnum("chain").notNull(),
    name: text("name"),
    symbol: text("symbol"),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tokens_address_chain_idx").on(table.address, table.chain),
  ]
);

// ── Token Scores ───────────────────────────────────────
//
//  SCORING PIPELINE:
//  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
//  │ GoPlus   │──▶│ Weight   │──▶│ Claude   │──▶│ Persist  │
//  │ DexScr.  │   │ Calc +   │   │ LLM      │   │ to DB    │
//  │ Farcaster│   │ Fallback │   │ Synthesis │   │          │
//  │ On-chain │   │ + Guard  │   │          │   │          │
//  └──────────┘   └──────────┘   └──────────┘   └──────────┘
//

export const tokenScores = pgTable(
  "token_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id")
      .references(() => tokens.id)
      .notNull(),
    score: decimal("score", { precision: 4, scale: 2 }).notNull(),
    verdict: verdictEnum("verdict").notNull(),
    confidence: confidenceEnum("confidence").notNull(),
    summary: text("summary"),
    redFlags: jsonb("red_flags").$type<string[]>().default([]),
    greenFlags: jsonb("green_flags").$type<string[]>().default([]),
    rawSignals: jsonb("raw_signals").$type<Record<string, unknown>>(),
    goplusAvailable: boolean("goplus_available").default(true).notNull(),
    socialAvailable: boolean("social_available").default(true).notNull(),
    modelVersion: text("model_version"),
    promptHash: text("prompt_hash"),
    outcome: outcomeEnum("outcome").default("pending").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("token_scores_token_id_scored_at_idx").on(
      table.tokenId,
      table.scoredAt
    ),
    index("token_scores_scored_at_idx").on(table.scoredAt),
  ]
);

// ── Invite Codes ───────────────────────────────────────

export const inviteCodes = pgTable("invite_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  plan: planEnum("plan").default("pro").notNull(),
  maxUses: integer("max_uses").default(1).notNull(),
  uses: integer("uses").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Watchlist Items (Phase 2) ──────────────────────────

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    tokenId: uuid("token_id")
      .references(() => tokens.id)
      .notNull(),
    scoreAtAdd: decimal("score_at_add", { precision: 4, scale: 2 }).notNull(),
    verdictAtAdd: verdictEnum("verdict_at_add").notNull(),
    alertThreshold: decimal("alert_threshold", {
      precision: 4,
      scale: 2,
    }).default("2.0"),
    lastAlertAt: timestamp("last_alert_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("watchlist_user_token_idx").on(table.userId, table.tokenId),
  ]
);

// ── Wallet Reputations (Phase 2) ───────────────────────

export const walletReputations = pgTable(
  "wallet_reputations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: text("address").notNull(),
    chain: chainEnum("chain").notNull(),
    tradesTracked: decimal("trades_tracked").default("0").notNull(),
    profitableTrades: decimal("profitable_trades").default("0").notNull(),
    accuracyPct: decimal("accuracy_pct", { precision: 5, scale: 2 }),
    avgEntryTimingHrs: decimal("avg_entry_timing_hrs", {
      precision: 8,
      scale: 2,
    }),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("wallet_rep_address_chain_idx").on(table.address, table.chain),
  ]
);
