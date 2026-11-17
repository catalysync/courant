"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { EyeIcon, ThumbsUpIcon, UsersIcon, VideoIcon } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en");

export const OverviewSection = () => {
  return (
    <Suspense fallback={<OverviewSectionSkeleton />}>
      <ErrorBoundary fallback={null}>
        <OverviewSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const OverviewSectionSkeleton = () => {
  return (
    <div className="px-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-3 h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const OverviewSectionSuspense = () => {
  const [overview] = trpc.analytics.getOverview.useSuspenseQuery();

  const stats = [
    {
      label: "Videos",
      value: overview.videos,
      icon: VideoIcon,
    },
    {
      label: "Views",
      value: overview.views,
      icon: EyeIcon,
    },
    {
      label: "Likes",
      value: overview.likes,
      icon: ThumbsUpIcon,
    },
    {
      label: "Subscribers",
      value: overview.subscribers,
      icon: UsersIcon,
    },
  ];

  return (
    <div className="px-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-5 flex items-start justify-between">
            <div className="flex flex-col gap-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {fmt(stat.value)}
              </span>
            </div>
            <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
              <stat.icon className="size-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};