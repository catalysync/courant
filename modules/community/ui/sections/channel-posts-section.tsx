"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { InfiniteScroll } from "@/components/infinite-scroll";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { trpc } from "@/trpc/client";

import { PostCard } from "../components/post-card";
import { PostComposer } from "../components/post-composer";

interface ChannelPostsSectionProps {
  userId: string;
}

export const ChannelPostsSection = ({ userId }: ChannelPostsSectionProps) => {
  return (
    <Suspense key={userId} fallback={<ChannelPostsSkeleton />}>
      <ErrorBoundary fallback={<p className="text-sm text-muted-foreground">Error loading posts.</p>}>
        <ChannelPostsSectionSuspense userId={userId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const ChannelPostsSkeleton = () => (
  <div className="flex flex-col gap-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-28 w-full" />
    ))}
  </div>
);

const ChannelPostsSectionSuspense = ({ userId }: ChannelPostsSectionProps) => {
  const [posts, query] = trpc.community.getChannelPosts.useSuspenseInfiniteQuery(
    {
      userId,
      limit: PAGE_DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const items = posts.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-y-4">
      <PostComposer userId={userId} />

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
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