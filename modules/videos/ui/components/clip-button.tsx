"use client";

import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ScissorsIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveModal } from "@/components/responsive-modal";
import { formatTime, getPlaybackTime } from "@/lib/playback-time";

interface ClipButtonProps {
  videoId: string;
}

export const ClipButton = ({ videoId }: ClipButtonProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <ClipButtonInner videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const ClipButtonInner = ({ videoId }: ClipButtonProps) => {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [clips] = trpc.community.getClips.useSuspenseQuery({ videoId });

  const [open, setOpen] = useState(false);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [title, setTitle] = useState("");

  const createClip = trpc.community.createClip.useMutation({
    onSuccess: (clip) => {
      void navigator.clipboard.writeText(`${location.origin}/clip/${clip.id}`);
      toast.success("Clip created — link copied");
      setOpen(false);
      utils.community.getClips.invalidate({ videoId });
    },
    onError: (e) => toast.error(e.message || "Could not create clip"),
  });

  const openDialog = () => {
    if (!session?.user) {
      toast.error("Sign in to create clips");
      return;
    }
    const t = Math.max(0, Math.floor(getPlaybackTime()));
    setStartSec(t);
    setEndSec(t + 5);
    setTitle("");
    setOpen(true);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ScissorsIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-bold">Clips</h2>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={openDialog}>
          <ScissorsIcon className="size-4" />
          Create clip
        </Button>
      </div>

      {clips.length > 0 && (
        <div className="flex flex-col">
          {clips.map((clip) => (
            <Link
              key={clip.id}
              href={`/clip/${clip.id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <span className="text-xs text-muted-foreground tabular-nums w-10 shrink-0">
                {formatTime(clip.startSec)}
              </span>
              <span className="text-sm truncate">{clip.title || "Untitled clip"}</span>
            </Link>
          ))}
        </div>
      )}

      <ResponsiveModal title="Create clip" open={open} onOpenChange={setOpen}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (endSec - startSec < 1) {
              toast.error("Clip must be at least 1 second long");
              return;
            }
            createClip.mutate({
              videoId,
              startSec,
              endSec,
              title: title.trim() || null,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Start (seconds)</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={startSec}
                onChange={(e) => setStartSec(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">End (seconds)</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={endSec}
                onChange={(e) => setEndSec(Number(e.target.value))}
              />
            </div>
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={120}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClip.isPending}>
              {createClip.isPending ? "Creating…" : "Create clip"}
            </Button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
};