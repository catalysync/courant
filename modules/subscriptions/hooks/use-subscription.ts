import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";

interface UseSubscriptionProps {
  userId: string;
  isSubscribed: boolean;
  fromVideoId?: string;
}

export const useSubscription = ({
  userId,
  isSubscribed,
  fromVideoId,
}: UseSubscriptionProps) => {
  const router = useRouter();
  const utils = trpc.useUtils();

  const subscribe = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      if (fromVideoId) {
        utils.videos.getOne.invalidate({ id: fromVideoId });
      }
      utils.users.getOne.invalidate({ id: userId });
      utils.videos.getManySubscribed.invalidate();
      utils.subscriptions.getMany.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });
  const unsubscribe = trpc.subscriptions.remove.useMutation({
    onSuccess: () => {
      if (fromVideoId) {
        utils.videos.getOne.invalidate({ id: fromVideoId });
      }
      utils.users.getOne.invalidate({ id: userId });
      utils.videos.getManySubscribed.invalidate();
      utils.subscriptions.getMany.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });

  const isPending = subscribe.isPending || unsubscribe.isPending;

  const onClick = () => {
    if (isSubscribed) {
      unsubscribe.mutate({ userId });
    } else {
      subscribe.mutate({ userId });
    }
  };

  return {
    isPending,
    onClick,
  };
};
