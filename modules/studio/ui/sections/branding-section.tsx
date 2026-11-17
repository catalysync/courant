"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import { Loader2Icon, PaletteIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const BrandingSection = () => {
  return (
    <Suspense fallback={<BrandingSectionSkeleton />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <BrandingSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const BrandingSectionSkeleton = () => {
  return (
    <div className="px-4">
      <Skeleton className="h-64 w-full" />
    </div>
  );
};

const BrandingSectionSuspense = () => {
  const utils = trpc.useUtils();
  const [branding] = trpc.branding.getMine.useSuspenseQuery();

  const [brandName, setBrandName] = useState(branding.brandName ?? "");
  const [tagline, setTagline] = useState(branding.tagline ?? "");
  const [brandColor, setBrandColor] = useState(branding.brandColor ?? "#3b82f6");

  const update = trpc.branding.update.useMutation({
    onSuccess: () => {
      utils.branding.getMine.invalidate();
      toast.success("Branding saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    const payload: {
      brandName?: string | null;
      brandColor?: string;
      tagline?: string | null;
      logoKey?: string | null;
    } = {};

    const nextBrandName = brandName.trim() ? brandName.trim() : null;
    if (nextBrandName !== (branding.brandName ?? null)) {
      payload.brandName = nextBrandName;
    }

    const nextTagline = tagline.trim() ? tagline.trim() : null;
    if (nextTagline !== (branding.tagline ?? null)) {
      payload.tagline = nextTagline;
    }

    if (brandColor !== (branding.brandColor ?? "#3b82f6")) {
      payload.brandColor = brandColor;
    }

    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save");
      return;
    }

    update.mutate(payload);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PaletteIcon className="size-4 text-muted-foreground" />
          Channel branding
        </CardTitle>
        <CardDescription>
          Give your channel a branded look across your pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              placeholder="Your channel name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="brand-tagline">Tagline</Label>
            <Input
              id="brand-tagline"
              placeholder="A short tagline for your channel"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-color">Brand color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="brand-color"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-16 cursor-pointer p-1"
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {brandColor}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Logo</Label>
          {branding.logoKey ? (
            <p className="text-xs text-muted-foreground">
              Logo set ({branding.logoKey})
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Logo upload isn&apos;t available here yet — it will be added soon.
          </p>
        </div>

        <Button type="button" onClick={onSave} disabled={update.isPending}>
          {update.isPending ? <Loader2Icon className="animate-spin" /> : null}
          Save branding
        </Button>
      </CardContent>
    </Card>
  );
};