import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
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
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
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
] as const;

export const notifications = sqliteTable(
  "notifications",
  {
    id: uuidPk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationType }).notNull(),
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
    createdAt: ts("created_at"),
  },
  (t) => [index("watch_events_video_idx").on(t.videoId), index("watch_events_user_idx").on(t.userId)],
);