"use client";

import { useRouter } from "next/navigation";
import { BellIcon, Loader2Icon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";

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

export const NotificationsBell = () => {
  const router = useRouter();
  const { data: session } = useSession();

  const utils = trpc.useUtils();
  const unread = trpc.notifications.getUnreadCount.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const notifications = trpc.notifications.getMany.useQuery(
    { limit: PAGE_DEFAULT_LIMIT },
    { enabled: !!session?.user },
  );

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMany.invalidate();
    },
  });

  const markAll = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMany.invalidate();
    },
  });

  if (!session?.user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <BellIcon className="size-5" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread.data}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => router.push("/notifications")}
            >
              View all
            </button>
            {(unread.data ?? 0) > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => markAll.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        {notifications.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!notifications.isLoading &&
          notifications.data?.items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => {
                if (!n.readAt) markAsRead.mutate({ id: n.id });
                if (n.videoId) router.push(`/videos/${n.videoId}`);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium text-sm truncate">{n.actor?.name ?? "Someone"}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {MESSAGES[n.type] ?? n.type}
                </span>
                {!n.readAt && <span className="ml-auto h-2 w-2 rounded-full bg-teal-500 shrink-0" />}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(n.createdAt, { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))}
        {!notifications.isLoading && notifications.data?.items.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};