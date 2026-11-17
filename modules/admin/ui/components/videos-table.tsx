"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SearchIcon, Globe2Icon, LockIcon, Trash2Icon, Loader2Icon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { trpc } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE = 50;

export const VideosTable = () => {
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.listVideos.useQuery({
    limit: PAGE,
    offset,
    query: query || null,
  });

  const setVisibility = trpc.admin.setVideoVisibility.useMutation({
    onSuccess: () => {
      utils.admin.listVideos.invalidate();
      toast.success("Visibility updated");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const setFeatured = trpc.admin.setFeatured.useMutation({
    onSuccess: () => {
      utils.admin.listVideos.invalidate();
      toast.success("Featured updated");
    },
    onError: () => toast.error("Something went wrong"),
  });

  const remove = trpc.admin.removeVideo.useMutation({
    onSuccess: () => {
      utils.admin.listVideos.invalidate();
      utils.admin.getStats.invalidate();
      toast.success("Video removed");
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
          placeholder="Search by title"
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Video</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10">
                  <Loader2Icon className="size-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              data?.items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <p className="font-medium line-clamp-1 max-w-[320px]">{v.title}</p>
                        <p className="text-xs text-muted-foreground">{v.id.slice(0, 8)}</p>
                      </div>
                      <Link
                        href={`/videos/${v.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLinkIcon className="size-4" />
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.user.name}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setVisibility.mutate({
                          videoId: v.id,
                          visibility: v.visibility === "public" ? "private" : "public",
                        })
                      }
                    >
                      {v.visibility === "public" ? (
                        <Globe2Icon className="size-4 mr-1" />
                      ) : (
                        <LockIcon className="size-4 mr-1" />
                      )}
                      {v.visibility}
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {v.streamStatus ?? "—"}
                  </TableCell>
                  <TableCell>{v.viewCount}</TableCell>
                  <TableCell>{v.likeCount}</TableCell>
                  <TableCell>{v.commentCount}</TableCell>
                  <TableCell>
                    <Switch
                      checked={v.isFeatured}
                      onCheckedChange={(checked) =>
                        setFeatured.mutate({ videoId: v.id, featured: checked })
                      }
                      aria-label="Featured"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Delete "${v.title}"? This cannot be undone.`)) {
                          remove.mutate({ videoId: v.id });
                        }
                      }}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && data && data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  No videos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} total videos</p>
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