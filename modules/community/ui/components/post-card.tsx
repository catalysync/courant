"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUpIcon, Trash2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";

import type { CommunityPostItem } from "../../types";

interface PostCardProps {
  post: CommunityPostItem;
}

export const PostCard = ({ post }: PostCardProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const utils = trpc.useUtils();

  const like = trpc.community.reactPost.useMutation({
    onSuccess: () => {
      utils.community.getChannelPosts.invalidate({ userId: post.author.id });
      utils.community.getFollowingFeed.invalidate();
    },
    onError: (error) => {
      toast.error("Something went wrong");
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });

  const remove = trpc.community.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      utils.community.getChannelPosts.invalidate({ userId: post.author.id });
      utils.community.getFollowingFeed.invalidate();
    },
    onError: (error) => {
      toast.error("Something went wrong");
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });

  const isAuthor = userId === post.author.id;
  const pollOptions = parsePollOptions(post.pollOptions);

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            prefetch
            href={`/users/${post.author.id}`}
            className="flex items-center gap-3 min-w-0"
          >
            <UserAvatar size="lg" imageUrl={post.author.image} name={post.author.name} />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{post.author.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(post.createdAt, { addSuffix: true })}
              </p>
            </div>
          </Link>

          {isAuthor && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: post.id })}
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>

        {post.text && <p className="text-sm whitespace-pre-wrap">{post.text}</p>}

        {post.type === "poll" && pollOptions.length > 0 && (
          <ul className="flex flex-col gap-y-2">
            {pollOptions.map((option, index) => (
              <li key={index} className="rounded-lg border px-3 py-2 text-sm">
                {option}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 pt-1 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={like.isPending}
            onClick={() => like.mutate({ postId: post.id, type: "like" })}
          >
            <ThumbsUpIcon className="size-4 mr-1" />
            Like
          </Button>
          {(post.likeCount ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">{post.likeCount}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

function parsePollOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((option): option is string => typeof option === "string")
      : [];
  } catch {
    return [];
  }
}