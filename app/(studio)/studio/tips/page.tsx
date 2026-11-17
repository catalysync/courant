import { TipsView } from "@/modules/studio/ui/views/tips-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.tips.getLedger.prefetch();
  void trpc.tips.getMany.prefetch({ direction: "received" });

  return (
    <HydrateClient>
      <TipsView />
    </HydrateClient>
  );
};

export default Page;