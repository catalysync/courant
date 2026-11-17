import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

/**
 * Courant D1 (SQLite) schema.
 *
 * Cloudflare D1 is SQLite. Differences from the old Postgres schema:
 *  - `uuid` -> `text` (values are still crypto.randomUUID()).
 *  - `pgEnum` -> `text(..., { enum: [...] })` (a CHECK constraint).
 *  - `timestamp` -> `integer(..., { mode: "timestamp_ms" })`.
 *  - `ilike` call sites are now `like` (SQLite LIKE is case-insensitive for ASCII).
 *  - No `inArray(col, [])`: SQLite `IN ()` is a syntax error; call sites guard with
 *    `eq(col, x)` / `sql`false`` instead.
 *
 * Auth is Better Auth (self-hosted) on the same D1 database. The `user` table is Better
 * Auth's canonical table (id, name, email, emailVerified, image) extended with Courant
 * profile fields (bannerUrl, bannerKey, role, username). There is no more `clerkId`.
 */

// ---- helpers -------------------------------------------------------------

/** text primary key, UUID by default (Better Auth tables set their own ids). */
const uuidPk = (name = "id") =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const ts = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

// ---- Better Auth core tables ---------------------------------------------
// Column names follow Better Auth field names (camelCase keys, snake_case columns).

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    // Courant profile fields (Better Auth additionalFields).
    bannerUrl: text("banner_url"),
    bannerKey: text("banner_key"),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    username: text("username").unique(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    check("user_email_verified_bool", sql`${t.emailVerified} IN (0, 1)`),
    check("user_role", sql`${t.role} IN ('user', 'admin')`),
    index("user_email_idx").on(t.email),
    index("user_role_idx").on(t.role),
    index("user_created_at").on(t.createdAt),
  ],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("session_user_idx").on(t.userId), index("session_expires_idx").on(t.expiresAt)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("account_provider_idx").on(t.providerId, t.accountId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---- domain tables -------------------------------------------------------

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    viewerId: text("viewer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [primaryKey({ name: "subscriptions_pk", columns: [t.viewerId, t.creatorId] })],
);

export const categories = sqliteTable(
  "categories",
  {
    id: uuidPk(),
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("categories_name_idx").on(t.name)],
);

export const videoVisibility = ["private", "public"] as const;
export const reactionType = ["like", "dislike"] as const;

export const videos = sqliteTable("videos", {
  id: uuidPk(),
  title: text("title").notNull(),
  description: text("description"),
  // Cloudflare Stream fields (replaces the Mux fields).
  streamUid: text("stream_uid").unique(),
  streamStatus: text("stream_status"),
  streamUploadId: text("stream_upload_id"),
  // Auto-generated preview / thumbnail from Stream.
  thumbnailUrl: text("thumbnail_url"),
  previewUrl: text("preview_url"),
  // Custom thumbnail uploaded to R2 (optional).
  thumbnailKey: text("thumbnail_key"),
  duration: integer("duration").default(0).notNull(),
  visibility: text("visibility", { enum: videoVisibility })
    .notNull()
    .default("private"),
  // ---- Privacy & access control (Phase 1) ----
  // isUnlisted + visibility together yield three effective states:
  //   public + !unlisted -> in feeds, anyone can watch
  //   public + unlisted  -> NOT in feeds, anyone with the link can watch
  //   private            -> creator only (or password / domain-restricted)
  isUnlisted: integer("is_unlisted", { mode: "boolean" })
    .notNull()
    .default(false),
  // If set, viewers must present this password (PBKDF2 hash) to watch / embed.
  passwordHash: text("password_hash"),
  // JSON array of hostnames allowed to embed / view (null = no restriction).
  allowedDomains: text("allowed_domains"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  // ---- Monetization (Phase 2) ----
  monetizationType: text("monetization_type").notNull().default("free"),
  priceCents: integer("price_cents").notNull().default(0),
  allowEmbed: integer("allow_embed", { mode: "boolean" }).notNull().default(true),
  // ---- Phase 3 (launch) ----
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  requireEmail: integer("require_email", { mode: "boolean" }).notNull().default(false),
  allowDownload: integer("allow_download", { mode: "boolean" }).notNull().default(false),
  endScreenType: text("end_screen_type").notNull().default("none"), // none | link | cta
  endScreenUrl: text("end_screen_url"),
  endScreenCta: text("end_screen_cta"),
  maturityRating: text("maturity_rating").notNull().default("general"), // general | mature
  audioQuality: text("audio_quality").notNull().default("standard"), // standard | high
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const videoSelectSchema = createSelectSchema(videos);
export const videoInsertSchema = createInsertSchema(videos);
export const videoUpdateSchema = createUpdateSchema(videos);

export const videoViews = sqliteTable(
  "video_views",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [primaryKey({ name: "video_views_pk", columns: [t.userId, t.videoId] })],
);

export const videoViewSelectSchema = createSelectSchema(videoViews);
export const videoViewInsertSchema = createInsertSchema(videoViews);
export const videoViewUpdateSchema = createUpdateSchema(videoViews);

export const videoReactions = sqliteTable(
  "video_reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    type: text("type", { enum: reactionType }).notNull(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [primaryKey({ name: "video_reactions_pk", columns: [t.userId, t.videoId] })],
);

export const videoReactionSelectSchema = createSelectSchema(videoReactions);
export const videoReactionInsertSchema = createInsertSchema(videoReactions);
export const videoReactionUpdateSchema = createUpdateSchema(videoReactions);

export const comments = sqliteTable(
  "comments",
  {
    id: uuidPk(),
    parentId: text("parent_id").references((): any => comments.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    // Frame-accurate review comment: seconds into the video (null = plain comment).
    timestampSec: real("timestamp_sec"),
    // Pinned by the video owner (shown above the rest).
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("comments_video_idx").on(t.videoId), index("comments_parent_idx").on(t.parentId)],
);

export const commentSelectSchema = createSelectSchema(comments);
export const commentInsertSchema = createInsertSchema(comments);
export const commentUpdateSchema = createUpdateSchema(comments);

export const commentReactions = sqliteTable(
  "comment_reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    type: text("type", { enum: reactionType }).notNull(),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    primaryKey({ name: "comment_reactions_pk", columns: [t.userId, t.commentId] }),
  ],
);

export const playlists = sqliteTable(
  "playlists",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    description: text("description"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("playlists_user_idx").on(t.userId)],
);

export const playlistVideos = sqliteTable(
  "playlist_videos",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [primaryKey({ name: "playlist_videos_pk", columns: [t.playlistId, t.videoId] })],
);

export const notificationType = [
  "new_subscriber",
  "new_video",
  "new_comment",
  "comment_reply",
  "comment_reaction",
  "video_reaction",
  "tip_received",
  "team_invite",
  "mention",
  "live_started",
] as const;

export const notifications = sqliteTable(
  "notifications",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    // Plain text (no CHECK) so we can add notification types without recreating the table.
    type: text("type").notNull(),
    videoId: text("video_id").references(() => videos.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

// ---- analytics -----------------------------------------------------------
// Watch-progress heartbeats power creator analytics (watch time / retention).

export const videoWatchEvents = sqliteTable(
  "video_watch_events",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    watchSeconds: integer("watch_seconds").notNull(),
    totalSeconds: integer("total_seconds").notNull(),
    // ---- Deep analytics (Phase 2) ----
    country: text("country"),
    device: text("device"),
    referrer: text("referrer"),
    createdAt: ts("created_at"),
  },
  (t) => [index("watch_events_video_idx").on(t.videoId), index("watch_events_user_idx").on(t.userId)],
);

// ---- creator review workflow (Phase 1) -------------------------------------
// Video replacement keeps the same video id / URL; each replacement adds a
// version row pointing at a new Stream asset. `videos.streamUid` is the active one.

export const videoVersions = sqliteTable(
  "video_versions",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    streamUid: text("stream_uid"),
    streamUploadId: text("stream_upload_id"),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailKey: text("thumbnail_key"),
    duration: integer("duration").default(0).notNull(),
    note: text("note"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("video_versions_video_idx").on(t.videoId)],
);

export const videoVersionSelectSchema = createSelectSchema(videoVersions);
export const videoVersionInsertSchema = createInsertSchema(videoVersions);

// ---- creator commerce (Phase 1, no ads) ------------------------------------
// Tip ledger. Amounts are integer cents.

export const tips = sqliteTable(
  "tips",
  {
    id: uuidPk(),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    note: text("note"),
    createdAt: ts("created_at"),
  },
  (t) => [index("tips_to_user_idx").on(t.toUserId), index("tips_from_user_idx").on(t.fromUserId)],
);

export const tipSelectSchema = createSelectSchema(tips);
export const tipInsertSchema = createInsertSchema(tips);

// Running-balance ledger for creator payouts.

export const ledgerType = ["tip_received", "payout", "adjustment"] as const;

export const ledger = sqliteTable(
  "ledger",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: ledgerType }).notNull(),
    amountCents: integer("amount_cents").notNull(), // signed delta
    balanceCents: integer("balance_cents").notNull(), // running balance after entry
    refType: text("ref_type"), // e.g. "tip"
    refId: text("ref_id"),
    note: text("note"),
    createdAt: ts("created_at"),
  },
  (t) => [index("ledger_user_idx").on(t.userId), index("ledger_created_idx").on(t.createdAt)],
);

export const ledgerSelectSchema = createSelectSchema(ledger);

// Workspaces / teams with roles.

export const teamRole = ["owner", "admin", "editor", "viewer"] as const;

export const teams = sqliteTable(
  "teams",
  {
    id: uuidPk(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
);

export const teamSelectSchema = createSelectSchema(teams);
export const teamInsertSchema = createInsertSchema(teams);
export const teamUpdateSchema = createUpdateSchema(teams);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: uuidPk(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: teamRole }).notNull().default("editor"),
    createdAt: ts("created_at"),
  },
  (t) => [
    index("team_members_team_idx").on(t.teamId),
    index("team_members_user_idx").on(t.userId),
    uniqueIndex("team_members_unique").on(t.teamId, t.userId),
  ],
);

export const teamMemberSelectSchema = createSelectSchema(teamMembers);
export const teamMemberInsertSchema = createInsertSchema(teamMembers);

// ---- Phase 2: AI suite (chapters, transcripts, embeddings) -----------------

export const chapters = sqliteTable(
  "chapters",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startSec: real("start_sec").notNull(),
    endSec: real("end_sec"),
    order: integer("order").notNull().default(0),
    createdAt: ts("created_at"),
  },
  (t) => [index("chapters_video_idx").on(t.videoId)],
);

export const chapterSelectSchema = createSelectSchema(chapters);
export const chapterInsertSchema = createInsertSchema(chapters);

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("draft"), // draft | generated
    source: text("source").notNull().default("manual"), // manual | stream | ai
    text: text("text"),
    // JSON array of { start, end, text } segments for the timed transcript.
    segments: text("segments"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    index("transcripts_video_idx").on(t.videoId),
    uniqueIndex("transcripts_video_lang_idx").on(t.videoId, t.language),
  ],
);

export const transcriptSelectSchema = createSelectSchema(transcripts);
export const transcriptInsertSchema = createInsertSchema(transcripts);

// Per-video text embedding (JSON number[]) for semantic search. One row per
// video (title + description), refreshed after updates.
export const videoEmbeddings = sqliteTable(
  "video_embeddings",
  {
    videoId: text("video_id")
      .primaryKey()
      .references(() => videos.id, { onDelete: "cascade" }),
    embedding: text("embedding").notNull(), // JSON number[]
    model: text("model").notNull(),
    updatedAt: ts("updated_at"),
  },
);

// ---- Phase 2: live streaming ----------------------------------------------

export const liveStatus = ["ready", "streaming", "ended"] as const;

export const liveStreams = sqliteTable(
  "live_streams",
  {
    id: uuidPk(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
    streamInputId: text("stream_input_id").notNull().unique(),
    rtmpUrl: text("rtmp_url"),
    streamKey: text("stream_key"),
    playbackUrl: text("playback_url"),
    title: text("title"),
    status: text("status").notNull().default("ready"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("live_streams_creator_idx").on(t.creatorId)],
);

export const liveStreamSelectSchema = createSelectSchema(liveStreams);
export const liveStreamInsertSchema = createInsertSchema(liveStreams);

// ---- Phase 2: payments (rental / purchase / membership) -------------------

export const monetizationType = ["free", "rental", "purchase", "membership"] as const;
export const purchaseStatus = ["pending", "completed", "refunded", "expired"] as const;

export const purchases = sqliteTable(
  "purchases",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // rental | purchase
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    provider: text("provider").notNull().default("stripe"),
    providerSessionId: text("provider_session_id"),
    status: text("status").notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("purchases_user_video_idx").on(t.userId, t.videoId)],
);

export const purchaseSelectSchema = createSelectSchema(purchases);
export const purchaseInsertSchema = createInsertSchema(purchases);

export const memberships = sqliteTable(
  "memberships",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tierName: text("tier_name").notNull().default("Supporter"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    provider: text("provider").notNull().default("stripe"),
    providerCustomerId: text("provider_customer_id"),
    status: text("status").notNull().default("active"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [
    index("memberships_user_idx").on(t.userId),
    index("memberships_creator_idx").on(t.creatorId),
    uniqueIndex("memberships_user_creator_idx").on(t.userId, t.creatorId),
  ],
);

export const membershipSelectSchema = createSelectSchema(memberships);

// ---- Phase 2: player customization ----------------------------------------

export const playerSettings = sqliteTable(
  "player_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    primaryColor: text("primary_color").notNull().default("#3b82f6"),
    watermarkText: text("watermark_text"),
    showWatermark: integer("show_watermark", { mode: "boolean" })
      .notNull()
      .default(false),
    autoPlay: integer("auto_play", { mode: "boolean" }).notNull().default(false),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
);

export const playerSettingsSelectSchema = createSelectSchema(playerSettings);
export const playerSettingsInsertSchema = createInsertSchema(playerSettings);
export const playerSettingsUpdateSchema = createUpdateSchema(playerSettings);

// Creator's membership (paid subscription) settings.
export const creatorSettings = sqliteTable(
  "creator_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    membershipEnabled: integer("membership_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    membershipPriceCents: integer("membership_price_cents").notNull().default(500),
    membershipTierName: text("membership_tier_name").notNull().default("Supporter"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
);

export const creatorSettingsSelectSchema = createSelectSchema(creatorSettings);
export const creatorSettingsInsertSchema = createInsertSchema(creatorSettings);
export const creatorSettingsUpdateSchema = createUpdateSchema(creatorSettings);

// ---- Phase 3: launch features ---------------------------------------------

// Shareable clip of a video segment (YouTube Clips).
export const clips = sqliteTable(
  "clips",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    startSec: real("start_sec").notNull(),
    endSec: real("end_sec").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => [index("clips_video_idx").on(t.videoId)],
);

export const postType = ["text", "poll", "image"] as const;

// Channel community posts (YouTube community tab).
export const posts = sqliteTable(
  "posts",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "set null" }),
    type: text("type").notNull().default("text"),
    text: text("text"),
    imageKey: text("image_key"),
    pollOptions: text("poll_options"), // JSON string[]
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("posts_user_idx").on(t.userId)],
);

export const postReactions = sqliteTable(
  "post_reactions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // like | dislike
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ name: "post_reactions_pk", columns: [t.userId, t.postId] })],
);

// Captured leads (Wistia Turnstile email-gate).
export const leads = sqliteTable(
  "leads",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: ts("created_at"),
  },
  (t) => [index("leads_video_idx").on(t.videoId), index("leads_user_idx").on(t.userId)],
);

// Clickable in-video hotspots (Vimeo).
export const hotspots = sqliteTable(
  "hotspots",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    startSec: real("start_sec").notNull(),
    endSec: real("end_sec"),
    label: text("label").notNull(),
    url: text("url"),
    color: text("color").notNull().default("#3b82f6"),
    createdAt: ts("created_at"),
  },
  (t) => [index("hotspots_video_idx").on(t.videoId)],
);

// Saved player presets (Vimeo player presets).
export const playerPresets = sqliteTable(
  "player_presets",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    primaryColor: text("primary_color").notNull().default("#3b82f6"),
    watermarkText: text("watermark_text"),
    showWatermark: integer("show_watermark", { mode: "boolean" }).notNull().default(false),
    autoPlay: integer("auto_play", { mode: "boolean" }).notNull().default(false),
    createdAt: ts("created_at"),
  },
  (t) => [index("player_presets_user_idx").on(t.userId)],
);

// Collaborative playlists (YouTube multi-user playlists).
export const playlistMembers = sqliteTable(
  "playlist_members",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // editor | viewer
    createdAt: ts("created_at"),
  },
  (t) => [
    primaryKey({ name: "playlist_members_pk", columns: [t.playlistId, t.userId] }),
  ],
);

// Viewer "saved for offline" queue (PWA offline).
export const offlineDownloads = sqliteTable(
  "offline_downloads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: ts("created_at"),
  },
  (t) => [primaryKey({ name: "offline_downloads_pk", columns: [t.userId, t.videoId] })],
);

// RSS / MRSS feed sources (Dailymotion ingest).
export const feedSources = sqliteTable(
  "feed_sources",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp_ms" }),
    createdAt: ts("created_at"),
  },
  (t) => [index("feed_sources_user_idx").on(t.userId)],
);

// Thumbnail/title A/B experiments (Wistia A/B testing).
export const experiments = sqliteTable(
  "experiments",
  {
    id: uuidPk(),
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    variantA: text("variant_a"), // JSON { title?, thumbnailKey? }
    variantB: text("variant_b"), // JSON { title?, thumbnailKey? }
    viewsA: integer("views_a").notNull().default(0),
    viewsB: integer("views_b").notNull().default(0),
    status: text("status").notNull().default("running"), // running | ended
    createdAt: ts("created_at"),
  },
  (t) => [index("experiments_video_idx").on(t.videoId)],
);

// Simulcast destinations for a live stream (Vimeo simulcasting).
export const simulcastDestinations = sqliteTable(
  "simulcast_destinations",
  {
    id: uuidPk(),
    liveStreamId: text("live_stream_id")
      .notNull()
      .references(() => liveStreams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rtmpUrl: text("rtmp_url").notNull(),
    streamKey: text("stream_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: ts("created_at"),
  },
  (t) => [index("simulcast_live_idx").on(t.liveStreamId)],
);

// Webinars (Wistia webinar engine): scheduled live + registration + recording.
export const webinars = sqliteTable(
  "webinars",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    liveStreamId: text("live_stream_id").references(() => liveStreams.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("scheduled"), // scheduled | live | ended
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("webinars_user_idx").on(t.userId)],
);

export const webinarRegistrations = sqliteTable(
  "webinar_registrations",
  {
    id: uuidPk(),
    webinarId: text("webinar_id")
      .notNull()
      .references(() => webinars.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: ts("created_at"),
  },
  (t) => [index("webinar_regs_webinar_idx").on(t.webinarId)],
);

// Per-creator channel branding (OTT-style branded channel).
export const channelBranding = sqliteTable(
  "channel_branding",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    brandName: text("brand_name"),
    brandColor: text("brand_color").notNull().default("#3b82f6"),
    tagline: text("tagline"),
    logoKey: text("logo_key"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
);

export const channelBrandingSelectSchema = createSelectSchema(channelBranding);
export const channelBrandingInsertSchema = createInsertSchema(channelBranding);
export const channelBrandingUpdateSchema = createUpdateSchema(channelBranding);

// ---- Phase 3.5: trust & safety ----

export const reportStatus = ["open", "resolved", "dismissed"] as const;

export const reports = sqliteTable(
  "reports",
  {
    id: uuidPk(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id").references(() => user.id, { onDelete: "cascade" }),
    videoId: text("video_id").references(() => videos.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: ts("created_at"),
  },
  (t) => [index("reports_status_idx").on(t.status)],
);

export const reportSelectSchema = createSelectSchema(reports);
export const reportInsertSchema = createInsertSchema(reports);