"use client";

import { InfiniteScroll } from "@/components/infinite-scroll";
import { UserAvatar } from "@/components/user-avatar";
import { HISTORY_PAGE_LIMIT } from "@/lib/constants";
import { VideoThumbnail } from "@/modules/videos/ui/components/video-thumbnail";
import { trpc } from "@/trpc/client";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

export const HistorySection = () => {
  return (
    <Suspense fallback={<HistorySectionSkeleton />}>
      <ErrorBoundary
        fallback={
          <div className="py-8 text-center text-sm text-muted-foreground">
            Something went wrong
          </div>
        }
      >
        <HistorySectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const HistorySectionSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <div className="w-[168px] aspect-video rounded-xl bg-muted animate-pulse" />
          <div className="flex-1 min-w-0 py-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

const HistorySectionSuspense = () => {
  const [history, query] = trpc.videoViews.getHistory.useSuspenseInfiniteQuery(
    { limit: HISTORY_PAGE_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const items = history.pages.flatMap((page) => page.items);

  if (!items.length) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No watch history yet.
      </div>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              prefetch
              href={`/videos/${item.id}`}
              className="group flex gap-4"
            >
              <div className="w-[168px] flex-none">
                <VideoThumbnail
                  duration={item.duration}
                  imageUrl={item.thumbnailUrl}
                  previewUrl={item.previewUrl}
                  title={item.title}
                />
              </div>
              <div className="flex-1 min-w-0 py-1">
                <h3 className="font-medium text-base line-clamp-2 group-hover:text-primary">
                  {item.title}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    size="sm"
                    imageUrl={item.user.image}
                    name={item.user.name}
                  />
                  <span className="text-xs text-muted-foreground">
                    {item.user.name}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  watched{" "}
                  {formatDistanceToNow(item.lastWatchedAt, { addSuffix: true })}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <InfiniteScroll
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};