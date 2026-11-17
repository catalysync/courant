import { GrowthView } from "@/modules/studio/ui/views/growth-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.categories.getMany.prefetch();
  void trpc.growth.getFeeds.prefetch();
  void trpc.growth.getExperiments.prefetch({ videoId: null });
  void trpc.studio.getMany.prefetch({ limit: 50 });

  return (
    <HydrateClient>
      <GrowthView />
    </HydrateClient>
  );
};

export default Page;