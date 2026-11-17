"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";

interface ChannelBrandingBannerProps {
  userId: string;
}

/** Applies a creator's channel branding (brand name/color/tagline) to their page. */
export const ChannelBrandingBanner = ({ userId }: ChannelBrandingBannerProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <ChannelBrandingBannerSuspense userId={userId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const ChannelBrandingBannerSuspense = ({ userId }: ChannelBrandingBannerProps) => {
  const [branding] = trpc.branding.get.useSuspenseQuery({ userId });
  if (!branding.brandName && !branding.tagline) return null;

  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: branding.brandColor, color: "#ffffff" }}
    >
      <div className="max-w-[1300px] mx-auto flex flex-col gap-1">
        <p className="text-lg font-bold">{branding.brandName ?? ""}</p>
        {branding.tagline && <p className="text-sm opacity-90">{branding.tagline}</p>}
      </div>
    </div>
  );
};