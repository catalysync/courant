import Link from "next/link";
import { VideoGetOneOutput } from "../../types";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { SubscriptionButton } from "@/modules/subscriptions/ui/components/subscription-button";
import { UserInfo } from "@/modules/users/ui/components/user-info";
import { useSubscription } from "@/modules/subscriptions/hooks/use-subscription";
import { TipButton } from "@/modules/tips/ui/components/tip-button";

interface VideoOwnerProps {
  user: VideoGetOneOutput["user"];
  videoId: string;
}

export const VideoOwner = ({ user, videoId }: VideoOwnerProps) => {
  const { data: session, isPending: isLoaded } = useSession();
  const userId = session?.user?.id;
  const { isPending, onClick } = useSubscription({
    userId: user.id,
    isSubscribed: user.viewerSubscribed,
    fromVideoId: videoId,
  });

  return (
    <div className="flex items-center sm:items-start justify-between sm:justify-start gap-3 min-w-0">
      <Link prefetch href={`/users/${user.id}`}>
        <div className="flex items-center gap-3 min-w-0">
          <UserAvatar size="lg" imageUrl={user.image} name={user.name} />
          <div className="flex flex-col gap-1 min-w-0">
            <UserInfo size="lg" name={user.name} />
            <span className="text-sm text-muted-foreground line-clamp-1">
              {user.subscriberCount} subscribers
            </span>
          </div>
        </div>
      </Link>
      {userId === user.id ? (
        <Button variant="secondary" className="rounded-full" asChild>
          <Link prefetch href={`/studio/videos/${videoId}`}>
            Edit video
          </Link>
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          {userId && <TipButton toUserId={user.id} videoId={videoId} />}
          <SubscriptionButton
            onClick={onClick}
            disabled={isPending || !isLoaded}
            isSubscribed={user.viewerSubscribed}
            className="flex-none"
          />
        </div>
      )}
    </div>
  );
};
