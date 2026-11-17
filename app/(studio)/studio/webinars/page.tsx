import { WebinarsView } from "@/modules/studio/ui/views/webinars-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.webinars.getMyWebinars.prefetch();

  return (
    <HydrateClient>
      <WebinarsView />
    </HydrateClient>
  );
};

export default Page;