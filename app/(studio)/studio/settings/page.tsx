import { SettingsView } from "@/modules/studio/ui/views/settings-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.player.getMine.prefetch();

  return (
    <HydrateClient>
      <SettingsView />
    </HydrateClient>
  );
};

export default Page;