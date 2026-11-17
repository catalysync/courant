"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { InfiniteScroll } from "@/components/infinite-scroll";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { trpc } from "@/trpc/client";

import { PostCard } from "../components/post-card";

export const FollowingFeedSection = () => {
  return (
    <Suspense fallback={<FollowingFeedSkeleton />}>
      <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Error loading posts.</p>}>
        <FollowingFeedSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const FollowingFeedSkeleton = () => (
  <div className="flex flex-col gap-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-28 w-full" />
    ))}
  </div>
);

const FollowingFeedSectionSuspense = () => {
  const [posts, query] = trpc.community.getFollowingFeed.useSuspenseInfiniteQuery(
    {
      limit: PAGE_DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const items = posts.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-y-4">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No posts yet. Subscribe to creators to see their posts here.
        </p>
      )}

      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <InfiniteScroll
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
};