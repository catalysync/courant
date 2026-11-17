"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ListVideoIcon } from "lucide-react";

import { trpc } from "@/trpc/client";

interface PublicPlaylistsSectionProps {
  userId: string;
}

/** A creator's public playlists, shown as "Showcases" on their channel page. */
export const PublicPlaylistsSection = ({ userId }: PublicPlaylistsSectionProps) => {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary fallback={null}>
        <PublicPlaylistsSectionSuspense userId={userId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const PublicPlaylistsSectionSuspense = ({ userId }: PublicPlaylistsSectionProps) => {
  const [playlists] = trpc.playlists.getPublic.useSuspenseQuery({ userId });
  if (!playlists.length) return null;

  return (
    <section className="flex flex-col gap-y-3">
      <div>
        <h2 className="text-xl font-bold">Showcases</h2>
        <p className="text-xs text-muted-foreground">Curated collections from this channel</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {playlists.map((p) => (
          <Link
            key={p.id}
            href={`/playlists/${p.id}`}
            className="group w-48 shrink-0 rounded-xl border overflow-hidden hover:bg-muted transition-colors"
          >
            <div className="aspect-video bg-muted flex items-center justify-center">
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <ListVideoIcon className="size-8 text-muted-foreground" />
              )}
            </div>
            <div className="p-2">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.videoCount} videos</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};