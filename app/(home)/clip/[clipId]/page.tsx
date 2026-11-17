import { ClipView } from "@/modules/community/ui/views/clip-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ clipId: string }>;
}

const Page = async ({ params }: PageProps) => {
  const { clipId } = await params;
  void trpc.community.getClip.prefetch({ id: clipId });

  return (
    <HydrateClient>
      <ClipView clipId={clipId} />
    </HydrateClient>
  );
};

export default Page;