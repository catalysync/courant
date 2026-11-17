"use client";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { VideoThumbnail } from "@/modules/videos/ui/components/video-thumbnail";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import { inferRouterOutputs } from "@trpc/server";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

const SHELF_LIMIT = 8;

type SubscriptionVideo =
  inferRouterOutputs<AppRouter>["discovery"]["getSubscriptionsFeed"]["items"][number];

export const HomeSubscriptionsSection = () => {
  const { data: session, isPending } = useSession();
  const signedIn = !!session?.user;

  if (isPending || !signedIn) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <HomeSubscriptionsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const HomeSubscriptionsSectionSuspense = () => {
  const [feed] = trpc.discovery.getSubscriptionsFeed.useSuspenseInfiniteQuery(
    {
      limit: SHELF_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const items = feed.pages.flatMap((page) => page.items);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">
        New from your subscriptions
      </h2>
      {items.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No new uploads yet"
          description="Subscribe to channels to see their new uploads here."
          action={
            <Button asChild variant="secondary">
              <Link href="/subscriptions">Browse channels</Link>
            </Button>
          }
        />
      ) : (
        <div
          className="gap-4 gap-y-10 grid grid-cols-1 sm:grid-cols-2 
      lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4
      [@media(min-width:1920px):grid-cols-5 [@media(min-width:2200px):grid-cols-6]
      "
        >
          {items.map((video) => (
            <SubscriptionCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </section>
  );
};

const SubscriptionCard = ({ video }: { video: SubscriptionVideo }) => {
  return (
    <Link
      prefetch
      href={`/videos/${video.id}`}
      className="group flex w-full flex-col gap-2"
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