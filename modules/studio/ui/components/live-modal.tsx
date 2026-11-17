"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { CopyIcon, Loader2Icon, RadioIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

interface LiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LiveModal = ({ open, onOpenChange }: LiveModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Go live</DialogTitle>
          <DialogDescription>
            Stream to your followers in real time.
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<LiveModalSkeleton />}>
          <LiveModalContent />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

const LiveModalSkeleton = () => {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-32 self-end" />
    </div>
  );
};

const LiveModalContent = () => {
  const trpcUtils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [myLive] = trpc.live.getMyLive.useSuspenseQuery();

  const startLive = trpc.live.startLive.useMutation({
    onSuccess: () => {
      toast.success("Live stream created");
      setTitle("");
      trpcUtils.live.getMyLive.invalidate();
      trpcUtils.live.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Could not start live stream");
    },
  });

  const setStreaming = trpc.live.setStreaming.useMutation({
    onSuccess: () => {
      toast.success("You're live!");
      trpcUtils.live.getMyLive.invalidate();
      trpcUtils.live.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Could not update stream status");
    },
  });

  const endLive = trpc.live.endLive.useMutation({
    onSuccess: () => {
      toast.success("Live stream ended");
      trpcUtils.live.getMyLive.invalidate();
      trpcUtils.live.getActive.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Could not end stream");
    },
  });

  if (!myLive) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="live-title">Title</Label>
          <Input
            id="live-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you streaming?"
            maxLength={120}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => startLive.mutate({ title: title.trim() || null })}
            disabled={startLive.isPending}
          >
            {startLive.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RadioIcon />
            )}
            Start live stream
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const isStreaming = myLive.status === "streaming";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm text-muted-foreground">{myLive.title}</p>
        {isStreaming ? (
          <Badge variant="destructive">Live</Badge>
        ) : (
          <Badge variant="secondary">Ready</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Point your encoder (OBS, Streamlabs, etc.) at the ingest details below,
        then press &ldquo;I&rsquo;m streaming now&rdquo;.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Server URL</p>
            <p className="truncate font-mono text-sm">
              {myLive.rtmpUrl ?? "Unavailable"}
            </p>
          </div>
          {myLive.rtmpUrl && <CopyButton value={myLive.rtmpUrl} />}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Stream key</p>
            <p className="truncate font-mono text-sm">
              {myLive.streamKey ?? "Unavailable"}
            </p>
          </div>
          {myLive.streamKey && <CopyButton value={myLive.streamKey} />}
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="destructive"
          onClick={() => endLive.mutate({ id: myLive.id })}
          disabled={endLive.isPending}
        >
          {endLive.isPending && <Loader2Icon className="animate-spin" />}
          End stream
        </Button>
        <Button
          onClick={() => setStreaming.mutate({ id: myLive.id })}
          disabled={setStreaming.isPending || isStreaming}
        >
          {setStreaming.isPending && <Loader2Icon className="animate-spin" />}
          I&rsquo;m streaming now
        </Button>
      </DialogFooter>
    </div>
  );
};

const CopyButton = ({ value }: { value: string }) => {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={() => {
        navigator.clipboard
          .writeText(value)
          .then(() => toast.success("Copied"))
          .catch(() => toast.error("Could not copy"));
      }}
    >
      <CopyIcon />
    </Button>
  );
};