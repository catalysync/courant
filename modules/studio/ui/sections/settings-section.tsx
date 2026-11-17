"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import { CrownIcon, MonitorPlayIcon } from "lucide-react";

import { useSession } from "@/lib/auth-client";
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
import { Switch } from "@/components/ui/switch";

export const SettingsSection = () => {
  return (
    <Suspense fallback={<SettingsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <SettingsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const SettingsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
};

const SettingsSectionSuspense = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <MembershipCard />
      <PlayerCard />
    </div>
  );
};

const MembershipCard = () => {
  const { data: session } = useSession();
  const creatorId = session?.user?.id;

  if (!creatorId) {
    return <Skeleton className="h-56 w-full" />;
  }

  return <MembershipCardSuspense creatorId={creatorId} />;
};

const MembershipCardSuspense = ({ creatorId }: { creatorId: string }) => {
  const utils = trpc.useUtils();
  const [settings] = trpc.payments.getMembershipSettings.useSuspenseQuery({ creatorId });

  const [enabled, setEnabled] = useState(settings.enabled);
  const [priceDollars, setPriceDollars] = useState((settings.priceCents / 100).toFixed(2));
  const [tierName, setTierName] = useState(settings.tierName);

  const save = trpc.payments.setMembershipSettings.useMutation({
    onSuccess: () => {
      utils.payments.getMembershipSettings.invalidate({ creatorId });
      toast.success("Membership settings saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    const dollars = Number.parseFloat(priceDollars);
    const priceCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
    save.mutate({ enabled, priceCents, tierName: tierName.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CrownIcon className="size-4 text-muted-foreground" />
          Channel membership
        </CardTitle>
        <CardDescription>
          Offer a monthly paid tier so viewers can support your channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-5">
        {!settings.paymentsConfigured && (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Payments are dormant until STRIPE_SECRET_KEY is set.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="membership-enabled">Enable membership</Label>
            <p className="text-xs text-muted-foreground">
              Let viewers join a paid tier on your channel
            </p>
          </div>
          <Switch
            id="membership-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="membership-price">Price (USD / month)</Label>
            <Input
              id="membership-price"
              type="number"
              min="1"
              step="0.01"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="membership-tier-name">Tier name</Label>
            <Input
              id="membership-tier-name"
              placeholder="Supporter"
              value={tierName}
              onChange={(e) => setTierName(e.target.value)}
            />
          </div>
        </div>

        <Button type="button" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save membership settings"}
        </Button>
      </CardContent>
    </Card>
  );
};

const PlayerCard = () => {
  const utils = trpc.useUtils();
  const [settings] = trpc.player.getMine.useSuspenseQuery();

  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [watermarkText, setWatermarkText] = useState(settings.watermarkText ?? "");
  const [showWatermark, setShowWatermark] = useState(settings.showWatermark);
  const [autoPlay, setAutoPlay] = useState(settings.autoPlay);

  const update = trpc.player.update.useMutation({
    onSuccess: () => {
      utils.player.getMine.invalidate();
      toast.success("Player settings saved");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const onSave = () => {
    const payload: {
      primaryColor?: string;
      watermarkText?: string | null;
      showWatermark?: boolean;
      autoPlay?: boolean;
    } = {};

    if (primaryColor !== settings.primaryColor) payload.primaryColor = primaryColor;

    const nextWatermark = watermarkText.trim() ? watermarkText.trim() : null;
    if (nextWatermark !== (settings.watermarkText ?? null)) {
      payload.watermarkText = nextWatermark;
    }

    if (showWatermark !== settings.showWatermark) payload.showWatermark = showWatermark;
    if (autoPlay !== settings.autoPlay) payload.autoPlay = autoPlay;

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
          <MonitorPlayIcon className="size-4 text-muted-foreground" />
          Player customization
        </CardTitle>
        <CardDescription>
          Customize how the video player looks and behaves on your channel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="player-primary-color">Primary color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="player-primary-color"
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
          <Label htmlFor="player-watermark-text">Watermark text</Label>
          <Input
            id="player-watermark-text"
            placeholder="Your channel name"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="player-show-watermark">Show watermark</Label>
            <p className="text-xs text-muted-foreground">
              Overlay the watermark text on your player
            </p>
          </div>
          <Switch
            id="player-show-watermark"
            checked={showWatermark}
            onCheckedChange={setShowWatermark}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="player-autoplay">Autoplay</Label>
            <p className="text-xs text-muted-foreground">
              Start videos automatically when the page loads
            </p>
          </div>
          <Switch
            id="player-autoplay"
            checked={autoPlay}
            onCheckedChange={setAutoPlay}
          />
        </div>

        <Button type="button" onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save player settings"}
        </Button>
      </CardContent>
    </Card>
  );
};