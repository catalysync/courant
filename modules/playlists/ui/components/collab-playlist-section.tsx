"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2Icon, UserPlusIcon, UsersIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface CollabPlaylistSectionProps {
  playlistId: string;
}

export const CollabPlaylistSection = ({ playlistId }: CollabPlaylistSectionProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-20" />}>
      <ErrorBoundary fallback={null}>
        <CollabPlaylistSectionSuspense playlistId={playlistId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const CollabPlaylistSectionSuspense = ({ playlistId }: CollabPlaylistSectionProps) => {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [playlist] = trpc.playlists.getOne.useSuspenseQuery({ id: playlistId });
  const [members] = trpc.collab.getMembers.useSuspenseQuery({ playlistId });
  const [email, setEmail] = useState("");

  const isOwner = session?.user?.id === playlist.userId;

  const invite = trpc.collab.invite.useMutation({
    onSuccess: () => {
      toast.success("Collaborator added");
      setEmail("");
      utils.collab.getMembers.invalidate({ playlistId });
    },
    onError: (e) => toast.error(e.message || "Could not add collaborator"),
  });
  const removeMember = trpc.collab.removeMember.useMutation({
    onSuccess: () => utils.collab.getMembers.invalidate({ playlistId }),
  });

  if (!isOwner) return null;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-3">
        <UsersIcon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Collaborators</h2>
        <span className="text-xs text-muted-foreground">{members.length}</span>
      </div>

      {members.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar size="sm" imageUrl={m.member.image} name={m.member.name} />
                <div className="min-w-0">
                  <p className="text-sm truncate">{m.member.name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeMember.mutate({ playlistId, userId: m.userId })}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Invite by email"
          className="h-9"
        />
        <Button
          type="button"
          size="sm"
          disabled={invite.isPending || !email}
          onClick={() => invite.mutate({ playlistId, email })}
        >
          <UserPlusIcon className="size-4 mr-2" />
          Invite
        </Button>
      </div>
    </div>
  );
};