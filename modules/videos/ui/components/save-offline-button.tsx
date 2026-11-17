"use client";

import { CheckIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** "Save for offline" toggle (PWA offline queue). */
export const SaveOfflineButton = ({ videoId }: { videoId: string }) => {
  const { data: session } = useSession();
  const utils = trpc.useUtils();

  const { data: offline } = trpc.collab.getOffline.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const saved = offline?.some((v) => v.id === videoId) ?? false;

  const save = trpc.collab.saveOffline.useMutation({
    onSuccess: () => {
      utils.collab.getOffline.invalidate();
      toast.success("Saved for offline");
    },
  });
  const remove = trpc.collab.removeOffline.useMutation({
    onSuccess: () => {
      utils.collab.getOffline.invalidate();
      toast.success("Removed from offline");
    },
  });

  if (!session?.user) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => (saved ? remove.mutate({ videoId }) : save.mutate({ videoId }))}
    >
      {saved ? <CheckIcon className="size-4 mr-2" /> : <DownloadIcon className="size-4 mr-2" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
};