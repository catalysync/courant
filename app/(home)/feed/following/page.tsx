import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { FollowingView } from "@/modules/community/ui/views/following-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.community.getFollowingFeed.prefetchInfinite({
    limit: PAGE_DEFAULT_LIMIT,
  });

  return (
    <HydrateClient>
      <FollowingView />
    </HydrateClient>
  );
};

export default Page;