"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { PlusIcon, TargetIcon, TrashIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface HotspotsEditorProps {
  videoId: string;
}

export const HotspotsEditor = ({ videoId }: HotspotsEditorProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <HotspotsEditorSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const HotspotsEditorSuspense = ({ videoId }: HotspotsEditorProps) => {
  const utils = trpc.useUtils();
  const [hotspots] = trpc.interactive.getHotspots.useSuspenseQuery({ videoId });

  const [label, setLabel] = useState("");
  const [startSec, setStartSec] = useState("");
  const [url, setUrl] = useState("");

  const create = trpc.interactive.createHotspot.useMutation({
    onSuccess: () => {
      utils.interactive.getHotspots.invalidate({ videoId });
      setLabel("");
      setStartSec("");
      setUrl("");
      toast.success("Hotspot added");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const remove = trpc.interactive.deleteHotspot.useMutation({
    onSuccess: () => {
      utils.interactive.getHotspots.invalidate({ videoId });
      toast.success("Hotspot removed");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onAdd = () => {
    const start = Number.parseFloat(startSec);
    if (!Number.isFinite(start) || start < 0) {
      toast.error("Enter a valid start time");
      return;
    }
    create.mutate({
      videoId,
      label: label.trim(),
      startSec: start,
      url: url.trim() ? url.trim() : null,
    });
  };

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex items-center gap-2">
        <TargetIcon className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Hotspots</h2>
      </div>

      {hotspots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hotspots yet. Add a clickable overlay that appears at a point in
          the video.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{hotspot.label}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(hotspot.startSec)}s
                  {hotspot.url ? ` · ${hotspot.url}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: hotspot.id })}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Add hotspot</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="hotspot-label">Label</Label>
            <Input
              id="hotspot-label"
              placeholder="Learn more"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hotspot-start">Start (seconds)</Label>
            <Input
              id="hotspot-start"
              type="number"
              min="0"
              step="0.1"
              placeholder="30"
              value={startSec}
              onChange={(e) => setStartSec(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hotspot-url">URL (optional)</Label>
            <Input
              id="hotspot-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Button
            type="button"
            size="sm"
            disabled={create.isPending || !label.trim() || !startSec}
            onClick={onAdd}
          >
            <PlusIcon className="size-4 mr-2" />
            {create.isPending ? "Adding…" : "Add hotspot"}
          </Button>
        </div>
      </div>
    </div>
  );
};