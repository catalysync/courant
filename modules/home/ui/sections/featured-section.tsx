"use client";

import { UserAvatar } from "@/components/user-avatar";
import { VideoThumbnail } from "@/modules/videos/ui/components/video-thumbnail";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

type FeaturedVideo =
  inferRouterOutputs<AppRouter>["discovery"]["getFeatured"][number];

export const FeaturedSection = () => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <FeaturedSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const FeaturedSectionSuspense = () => {
  const [featured] = trpc.discovery.getFeatured.useSuspenseQuery();

  if (featured.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Featured</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {featured.map((video) => (
          <FeaturedCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
};

const FeaturedCard = ({ video }: { video: FeaturedVideo }) => {
  return (
    <Link
      prefetch
      href={`/videos/${video.id}`}
      className="group flex w-72 shrink-0 flex-col gap-2 sm:w-80"
    >
      <VideoThumbnail
        duration={video.duration}
        imageUrl={video.thumbnailUrl}
        previewUrl={video.previewUrl}
        title={video.title}
      />
      <div className="flex items-center gap-2">
        <UserAvatar
          size="sm"
          imageUrl={video.user.image}
          name={video.user.name}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{video.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {video.user.name}
          </p>
        </div>
      </div>
    </Link>
  );
};