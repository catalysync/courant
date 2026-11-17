"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SearchIcon, ShieldCheckIcon, UserIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { trpc } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE = 50;

export const UsersTable = () => {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.listUsers.useQuery({
    limit: PAGE,
    offset,
    query: query || null,
  });

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success("Role updated");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const remove = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      utils.admin.getStats.invalidate();
      toast.success("User deleted");
    },
    onError: () => toast.error("Something went wrong"),
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Search by name or email"
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscribers</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2Icon className="size-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              data?.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar size="sm" imageUrl={u.image} name={u.name} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {u.role === "admin" ? (
                        <ShieldCheckIcon className="size-3 text-teal-400" />
                      ) : (
                        <UserIcon className="size-3" />
                      )}
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell>{u.subscriberCount}</TableCell>
                  <TableCell>{u.videoCount}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(u.createdAt, { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRole.mutate({
                            userId: u.id,
                            role: u.role === "admin" ? "user" : "admin",
                          })
                        }
                      >
                        {u.role === "admin" ? "Demote" : "Make admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${u.name}? This cannot be undone.`)) {
                            remove.mutate({ userId: u.id });
                          }
                        }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} total users
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(data?.items.length ?? 0) < PAGE}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};