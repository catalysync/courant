import { PayoutsView } from "@/modules/studio/ui/views/payouts-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.tips.getLedger.prefetch();

  return (
    <HydrateClient>
      <PayoutsView />
    </HydrateClient>
  );
};

export default Page;