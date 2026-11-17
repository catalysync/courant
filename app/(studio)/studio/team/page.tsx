import { TeamsView } from "@/modules/studio/ui/views/teams-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

const Page = () => {
  void trpc.teams.getMyTeams.prefetch();

  return (
    <HydrateClient>
      <TeamsView />
    </HydrateClient>
  );
};

export default Page;