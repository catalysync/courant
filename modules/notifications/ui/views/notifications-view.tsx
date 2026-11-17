"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { useSession } from "@/lib/auth-client";

const MESSAGES: Record<string, string> = {
  new_subscriber: "subscribed to you",
  new_comment: "commented on your video",
  comment_reply: "replied to your comment",
  comment_reaction: "reacted to your comment",
  video_reaction: "liked your video",
  new_video: "uploaded a new video",
  tip_received: "sent you a tip",
  team_invite: "invited you to a team",
  mention: "mentioned you",
  live_started: "is now live",
};

export const NotificationsView = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <ErrorBoundary fallback={<p className="text-muted-foreground">Error</p>}>
          <NotificationsInbox />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
};

const NotificationsInbox = () => {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [pages, query] = trpc.notifications.getMany.useSuspenseInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  const markAll = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMany.invalidate();
      toast.success("All notifications marked as read");
    },
  });

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMany.invalidate();
    },
  });

  if (!session?.user) {
    return <p className="text-muted-foreground">Sign in to see notifications.</p>;
  }

  const items = pages.pages.flatMap((p) => p.items);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellIcon className="size-5" />
          <h1 className="text-xl font-bold">Notifications</h1>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheckIcon className="size-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => {
            const href = n.videoId
              ? `/videos/${n.videoId}`
              : n.actorId
                ? `/users/${n.actorId}`
                : "#";
            const content = (
              <>
                <div className="flex items-start gap-3">
                  {n.actor && <UserAvatar size="sm" imageUrl={n.actor.image} name={n.actor.name} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{n.actor?.name ?? "Someone"}</span>{" "}
                      {MESSAGES[n.type] ?? n.type}
                    </p>
                    {n.video?.title && (
                      <p className="text-xs text-muted-foreground truncate">{n.video.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {!n.readAt && <span className="size-2 rounded-full bg-primary mt-1.5" />}
                </div>
              </>
            );
            return n.videoId || n.actorId ? (
              <Link
                key={n.id}
                href={href}
                onClick={() => !n.readAt && markAsRead.mutate({ id: n.id })}
                className="rounded-xl border p-3 hover:bg-muted transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div key={n.id} className="rounded-xl border p-3">
                {content}
              </div>
            );
          })}
          <InfiniteScroll
            isManual
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            fetchNextPage={query.fetchNextPage}
          />
        </div>
      )}
    </>
  );
};