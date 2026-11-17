import { PresetsView } from "@/modules/studio/ui/views/presets-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.interactive.getPresets.prefetch();

  return (
    <HydrateClient>
      <PresetsView />
    </HydrateClient>
  );
};

export default Page;