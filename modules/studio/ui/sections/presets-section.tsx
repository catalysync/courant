"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { MonitorPlayIcon, PlusIcon, TrashIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export const PresetsSection = () => {
  return (
    <Suspense fallback={<PresetsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <PresetsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const PresetsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
};

const PresetsSectionSuspense = () => {
  const utils = trpc.useUtils();
  const [presets] = trpc.interactive.getPresets.useSuspenseQuery();

  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [watermarkText, setWatermarkText] = useState("");
  const [showWatermark, setShowWatermark] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const create = trpc.interactive.createPreset.useMutation({
    onSuccess: () => {
      utils.interactive.getPresets.invalidate();
      setName("");
      setPrimaryColor("#3b82f6");
      setWatermarkText("");
      setShowWatermark(false);
      setAutoPlay(false);
      toast.success("Preset created");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const remove = trpc.interactive.deletePreset.useMutation({
    onSuccess: () => {
      utils.interactive.getPresets.invalidate();
      toast.success("Preset deleted");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onCreate = () => {
    create.mutate({
      name: name.trim(),
      primaryColor,
      watermarkText: watermarkText.trim() ? watermarkText.trim() : null,
      showWatermark,
      autoPlay,
    });
  };

  return (
    <div className="px-4 flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center gap-y-2 rounded-xl border border-dashed py-12 text-center">
            <MonitorPlayIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No player presets yet</p>
            <p className="text-xs text-muted-foreground">
              Create a preset to reuse a player look across your videos.
            </p>
          </div>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{preset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preset.primaryColor}
                  {preset.watermarkText ? ` · “${preset.watermarkText}”` : ""}
                  {preset.showWatermark ? " · watermark" : ""}
                  {preset.autoPlay ? " · autoplay" : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: preset.id })}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-y-4 rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">New preset</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preset-name">Name</Label>
          <Input
            id="preset-name"
            placeholder="My player preset"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preset-color">Primary color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="preset-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-16 cursor-pointer p-1"
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {primaryColor}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="preset-watermark">Watermark text</Label>
          <Input
            id="preset-watermark"
            placeholder="Your channel name"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="preset-show-watermark">Show watermark</Label>
          <Switch
            id="preset-show-watermark"
            checked={showWatermark}
            onCheckedChange={setShowWatermark}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="preset-autoplay">Autoplay</Label>
          <Switch
            id="preset-autoplay"
            checked={autoPlay}
            onCheckedChange={setAutoPlay}
          />
        </div>
        <div>
          <Button
            type="button"
            disabled={create.isPending || !name.trim()}
            onClick={onCreate}
          >
            <PlusIcon className="size-4 mr-2" />
            {create.isPending ? "Creating…" : "Create preset"}
          </Button>
        </div>
      </div>
    </div>
  );
};