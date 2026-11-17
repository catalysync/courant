"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/trpc/client";
import {
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";

type TeamRole = "owner" | "admin" | "editor" | "viewer";

const editableRoles = ["admin", "editor", "viewer"] as const;
type EditableRole = (typeof editableRoles)[number];

const roleBadgeVariant: Record<TeamRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  editor: "outline",
  viewer: "outline",
};

const roleLabel: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

interface Team {
  id: string;
  name: string;
  ownerId: string;
  role: TeamRole;
  memberCount: number;
}

export const TeamsSection = () => {
  return (
    <Suspense fallback={<TeamsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <TeamsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const TeamsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
};

const TeamsSectionSuspense = () => {
  const [teams] = trpc.teams.getMyTeams.useSuspenseQuery();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="px-4 flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {teams.length} {teams.length === 1 ? "team" : "teams"}
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          Create team
        </Button>
      </div>

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-y-2 py-12 text-center">
            <UsersIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No teams yet</p>
            <p className="text-xs text-muted-foreground">
              Create a team to collaborate on your channel.
            </p>
          </CardContent>
        </Card>
      ) : (
        teams.map((team) => <TeamCard key={team.id} team={team} />)
      )}
    </div>
  );
};

const CreateTeamDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");

  const create = trpc.teams.create.useMutation({
    onSuccess: () => {
      utils.teams.getMyTeams.invalidate();
      toast.success("Team created");
      setName("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ name });
          }}
          className="flex flex-col gap-y-4"
        >
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My team"
              maxLength={60}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TeamCard = ({ team }: { team: Team }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-x-2">
          <div className="flex items-center gap-x-3 min-w-0">
            <CardTitle className="truncate">{team.name}</CardTitle>
            <Badge variant={roleBadgeVariant[team.role]}>
              {roleLabel[team.role]}
            </Badge>
          </div>
          <div className="flex items-center gap-x-2 shrink-0">
            <span className="text-xs text-muted-foreground flex items-center gap-x-1">
              <UsersIcon className="size-3.5" />
              {team.memberCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((prev) => !prev)}
            >
              {open ? "Hide" : "Manage"}
              <ChevronDownIcon
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-180",
                )}
              />
            </Button>
          </div>
        </div>
        <CardDescription>
          {roleLabel[team.role]} · {team.memberCount}{" "}
          {team.memberCount === 1 ? "member" : "members"}
        </CardDescription>
      </CardHeader>

      {open ? (
        <>
          <Separator />
          <CardContent className="pt-6">
            <Suspense fallback={<TeamMembersSkeleton />}>
              <ErrorBoundary fallback={<p>Error...</p>}>
                <TeamMembers team={team} currentUserId={currentUserId} />
              </ErrorBoundary>
            </Suspense>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
};

const TeamMembersSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <Skeleton className="h-5 w-28" />
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="flex items-center gap-x-3">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex flex-col gap-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
};

const TeamMembers = ({
  team,
  currentUserId,
}: {
  team: Team;
  currentUserId?: string;
}) => {
  const utils = trpc.useUtils();
  const [members] = trpc.teams.getMembers.useSuspenseQuery({ teamId: team.id });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("editor");

  const isOwner = team.role === "owner";
  const canManage = team.role === "owner" || team.role === "admin";

  const invite = trpc.teams.invite.useMutation({
    onSuccess: () => {
      utils.teams.getMembers.invalidate({ teamId: team.id });
      utils.teams.getMyTeams.invalidate();
      toast.success("Invite sent");
      setEmail("");
      setRole("editor");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRole = trpc.teams.updateRole.useMutation({
    onSuccess: () => {
      utils.teams.getMembers.invalidate({ teamId: team.id });
      toast.success("Role updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMember = trpc.teams.removeMember.useMutation({
    onSuccess: () => {
      utils.teams.getMembers.invalidate({ teamId: team.id });
      utils.teams.getMyTeams.invalidate();
      toast.success("Member removed");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteTeam = trpc.teams.delete.useMutation({
    onSuccess: () => {
      utils.teams.getMyTeams.invalidate();
      toast.success("Team deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex flex-col gap-y-5">
      {canManage ? (
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="invite-email">Invite a member</Label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ teamId: team.id, email, role });
            }}
            className="flex flex-col sm:flex-row gap-y-2 gap-x-2"
          >
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="flex-1"
            />
            <Select
              value={role}
              onValueChange={(value) => setRole(value as EditableRole)}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {editableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!email.trim() || invite.isPending}>
              {invite.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Invite
            </Button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-col gap-y-1">
        <p className="text-sm font-medium">Members</p>
        {members.map((member) => {
          const isSelf = member.user.id === currentUserId;
          const isOwnerMember = member.role === "owner";

          return (
            <div
              key={member.user.id}
              className="flex items-center justify-between gap-x-2 py-1.5"
            >
              <div className="flex items-center gap-x-3 min-w-0">
                <UserAvatar
                  imageUrl={member.user.image}
                  name={member.user.name}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.user.name}
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-x-2 shrink-0">
                {isOwner && !isOwnerMember ? (
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      updateRole.mutate({
                        teamId: team.id,
                        userId: member.user.id,
                        role: value as EditableRole,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editableRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={roleBadgeVariant[member.role]}>
                    {roleLabel[member.role]}
                  </Badge>
                )}

                {canManage && !isOwnerMember && !isSelf ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() =>
                      removeMember.mutate({
                        teamId: team.id,
                        userId: member.user.id,
                      })
                    }
                    disabled={removeMember.isPending}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {isOwner ? (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-x-2">
            <div>
              <p className="text-sm font-medium text-destructive">Danger zone</p>
              <p className="text-xs text-muted-foreground">
                Deleting a team removes it for everyone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTeam.mutate({ teamId: team.id })}
              disabled={deleteTeam.isPending}
            >
              {deleteTeam.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <TrashIcon />
              )}
              Delete team
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};