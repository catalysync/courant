"use client";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { trpc } from "@/trpc/client";
import { inferRouterOutputs } from "@trpc/server";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { AppRouter } from "@/trpc/routers/_app";

type LiveStream = inferRouterOutputs<AppRouter>["live"]["getActive"][number];

export const LiveSection = () => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <LiveSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const LiveSectionSuspense = () => {
  const [liveStreams] = trpc.live.getActive.useSuspenseQuery();

  if (liveStreams.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold tracking-tight">Live now</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {liveStreams.map((stream) => (
          <LiveCard key={stream.id} stream={stream} />
        ))}
      </div>
    </section>
  );
};

const LiveCard = ({ stream }: { stream: LiveStream }) => {
  return (
    <Link
      href={`/live/${stream.id}`}
      className="group flex w-64 shrink-0 flex-col gap-2"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/60 via-black to-black" />
        <div className="absolute left-2 top-2">
          <Badge variant="destructive" className="uppercase tracking-wide">
            Live
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <UserAvatar
          size="sm"
          imageUrl={stream.creator.image}
          name={stream.creator.name}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{stream.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {stream.creator.name}
          </p>
        </div>
      </div>
    </Link>
  );
};