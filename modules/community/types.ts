import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";

export type CommunityPost =
  inferRouterOutputs<AppRouter>["community"]["getChannelPosts"]["items"][number];

// Structural shape rendered by <PostCard />. `getFollowingFeed` does not select
// `likeCount`, so keep it optional here so the card works for both feeds.
export type CommunityPostItem = Pick<
  CommunityPost,
  "id" | "text" | "type" | "pollOptions" | "createdAt" | "author"
> & { likeCount?: number | null };