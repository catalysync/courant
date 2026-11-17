import { BrandingView } from "@/modules/studio/ui/views/branding-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.branding.getMine.prefetch();

  return (
    <HydrateClient>
      <BrandingView />
    </HydrateClient>
  );
};

export default Page;