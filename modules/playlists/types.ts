import { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";

export type PlaylistsGetManyOutput = inferRouterOutputs<AppRouter>["playlists"]["getMany"];
export type PlaylistGetManyVideosOutput =
  inferRouterOutputs<AppRouter>["playlists"]["getVideos"];