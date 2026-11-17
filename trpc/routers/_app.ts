import { categoriesRouter } from "@/modules/categories/server/procedures";
import { createTRPCRouter } from "../init";
import { videosRouter } from "@/modules/videos/server/procedures";
import { studioRouter } from "@/modules/studio/server/procedures";
import { videoViewsRouter } from "@/modules/video-views/server/procedures";
import { videoReactionsRouter } from "@/modules/video-reactions/server/procedures";
import { subscriptionsRouter } from "@/modules/subscriptions/server/procedures";
import { usersRouter } from "@/modules/users/server/procedures";
import { searchRouter } from "@/modules/search/server/procedures";
import { suggestionsRouter } from "@/modules/suggestions/server/procedures";
import { commentsRouter } from "@/modules/comments/server/procedures";
import { commentReactionsRouter } from "@/modules/comment-reactions/server/procedures";
import { playlistsRouter } from "@/modules/playlists/server/procedures";
import { adminRouter } from "@/modules/admin/server/procedures";
import { analyticsRouter } from "@/modules/analytics/server/procedures";
import { notificationsRouter } from "@/modules/notifications/server/procedures";
import { tipsRouter } from "@/modules/tips/server/procedures";
import { teamsRouter } from "@/modules/teams/server/procedures";
import { aiRouter } from "@/modules/ai/server/procedures";
import { liveRouter } from "@/modules/live/server/procedures";
import { paymentsRouter } from "@/modules/payments/server/procedures";
import { playerRouter } from "@/modules/player/server/procedures";

export const appRouter = createTRPCRouter({
  users: usersRouter,
  categories: categoriesRouter,
  studio: studioRouter,
  videos: videosRouter,
  search: searchRouter,
  videoViews: videoViewsRouter,
  videoReactions: videoReactionsRouter,
  subscriptions: subscriptionsRouter,
  suggestions: suggestionsRouter,
  comments: commentsRouter,
  commentReactions: commentReactionsRouter,
  playlists: playlistsRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  notifications: notificationsRouter,
  tips: tipsRouter,
  teams: teamsRouter,
  ai: aiRouter,
  live: liveRouter,
  payments: paymentsRouter,
  player: playerRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;