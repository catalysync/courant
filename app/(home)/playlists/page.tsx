import { PAGE_DEFAULT_LIMIT } from "@/lib/constants";
import { HydrateClient, trpc } from "@/trpc/server";

import { PlaylistsView } from "@/modules/playlists/ui/views/playlists-view";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.playlists.getMany.prefetchInfinite({ limit: PAGE_DEFAULT_LIMIT });

  return (
    <HydrateClient>
      <PlaylistsView />
    </HydrateClient>
  );
};

export default Page;