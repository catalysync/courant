"use client";

import {
  VideoGridCard,
  VideoGridCardSkeleton,
} from "@/modules/videos/ui/components/video-grid-card";
import { trpc } from "@/trpc/client";
import { ArrowRight, FlameIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

const SHELF_LIMIT = 8;

export const HomeTrendingSection = () => {
  return (
    <Suspense fallback={<HomeTrendingSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <HomeTrendingSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const HomeTrendingSkeleton = () => {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FlameIcon className="size-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Trending now</h2>
      </div>
      <div
        className="gap-4 gap-y-10 grid grid-cols-1 sm:grid-cols-2 
      lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4
      [@media(min-width:1920px):grid-cols-5 [@media(min-width:2200px):grid-cols-6]
      "
      >
        {Array.from({ length: SHELF_LIMIT }).map((_, index) => (
          <VideoGridCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
};

const HomeTrendingSectionSuspense = () => {
  const [videos] = trpc.videos.getManyTrending.useSuspenseInfiniteQuery(
    {
      limit: SHELF_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const items = videos.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlameIcon className="size-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Trending now</h2>
        </div>
        <Link
          href="/feed/trending"
          className="group flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div
        className="gap-4 gap-y-10 grid grid-cols-1 sm:grid-cols-2 
      lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4
      [@media(min-width:1920px):grid-cols-5 [@media(min-width:2200px):grid-cols-6]
      "
      >
        {items.map((video) => (
          <VideoGridCard key={video.id} data={video} />
        ))}
      </div>
    </section>
  );
};