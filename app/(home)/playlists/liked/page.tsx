import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { HydrateClient, trpc } from "@/trpc/server";

import { LikedView } from "@/modules/playlists/ui/views/liked-view";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.playlists.getLiked.prefetchInfinite({ limit: PAGE_DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <LikedView />
    </HydrateClient>
  );
};

export default Page;