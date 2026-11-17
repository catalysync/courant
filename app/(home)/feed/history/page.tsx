import { HISTORY_PAGE_LIMIT } from "@/lib/constants";
import { HistoryView } from "@/modules/video-views/ui/views/history-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = async () => {
  void trpc.videoViews.getHistory.prefetchInfinite({
    limit: HISTORY_PAGE_LIMIT,
  });

  return (
    <HydrateClient>
      <HistoryView />
    </HydrateClient>
  );
};

export default Page;