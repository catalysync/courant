import { LiveView } from "@/modules/live/ui/views/live-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { id } = await params;
  void trpc.live.getLive.prefetch({ id });

  return (
    <HydrateClient>
      <LiveView liveId={id} />
    </HydrateClient>
  );
};

export default Page;