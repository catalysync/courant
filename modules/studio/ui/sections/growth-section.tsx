"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import {
  CloudDownloadIcon,
  FlaskConicalIcon,
  Loader2Icon,
  RssIcon,
  TrashIcon,
} from "lucide-react";

import { trpc } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Category = { id: string; name: string };

export const GrowthSection = () => {
  return (
    <Suspense fallback={<GrowthSectionSkeleton />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <GrowthSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const GrowthSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
};

const GrowthSectionSuspense = () => {
  const [categories] = trpc.categories.getMany.useSuspenseQuery();

  return (
    <div className="px-4 flex flex-col gap-y-6">
      <ImportFromUrlCard categories={categories} />
      <FeedsCard categories={categories} />
      <ExperimentsCard />
    </div>
  );
};

const CategorySelect = ({
  value,
  onChange,
  categories,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  categories: Category[];
}) => {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(next) => onChange(next === "none" ? null : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder="No category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No category</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ImportFromUrlCard = ({ categories }: { categories: Category[] }) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const importVideo = trpc.growth.importFromUrl.useMutation({
    onSuccess: () => {
      toast.success("Import started", {
        description:
          "Video imports in the background. It will appear in Content shortly.",
      });
      setUrl("");
      setTitle("");
      setCategoryId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudDownloadIcon className="size-4 text-muted-foreground" />
          Import video from URL
        </CardTitle>
        <CardDescription>
          Pull a video from a direct download URL into your channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            importVideo.mutate({
              url,
              title: title.trim() ? title.trim() : null,
              categoryId,
            });
          }}
          className="flex flex-col gap-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="import-url">Video URL</Label>
              <Input
                id="import-url"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="import-title">Title (optional)</Label>
              <Input
                id="import-title"
                placeholder="My imported video"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label>Category</Label>
              <CategorySelect
                value={categoryId}
                onChange={setCategoryId}
                categories={categories}
              />
            </div>
          </div>
          <div className="flex items-center gap-x-2">
            <Button
              type="submit"
              disabled={!url.trim() || importVideo.isPending}
            >
              {importVideo.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Import video
            </Button>
            <p className="text-xs text-muted-foreground">
              Video imports in the background.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const FeedsCard = ({ categories }: { categories: Category[] }) => {
  const utils = trpc.useUtils();
  const [feeds] = trpc.growth.getFeeds.useSuspenseQuery();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const createFeed = trpc.growth.createFeed.useMutation({
    onSuccess: () => {
      utils.growth.getFeeds.invalidate();
      toast.success("Feed added");
      setName("");
      setUrl("");
      setCategoryId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const importFeed = trpc.growth.importFeed.useMutation({
    onSuccess: (result) => {
      utils.growth.getFeeds.invalidate();
      toast.success(
        `Imported ${result.imported} ${result.imported === 1 ? "video" : "videos"}`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteFeed = trpc.growth.deleteFeed.useMutation({
    onSuccess: () => {
      utils.growth.getFeeds.invalidate();
      toast.success("Feed deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RssIcon className="size-4 text-muted-foreground" />
          RSS feeds
        </CardTitle>
        <CardDescription>
          Import videos from RSS / MRSS feeds on demand.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createFeed.mutate({ name: name.trim(), url, categoryId });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="feed-name">Feed name</Label>
            <Input
              id="feed-name"
              placeholder="My podcast feed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="feed-url">Feed URL</Label>
            <Input
              id="feed-url"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Category</Label>
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={!name.trim() || !url.trim() || createFeed.isPending}
            >
              {createFeed.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              Add feed
            </Button>
          </div>
        </form>

        {feeds.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No feeds yet. Add an RSS feed to import its videos.
          </p>
        ) : (
          <div className="flex flex-col gap-y-2">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between gap-x-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{feed.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {feed.url}
                  </p>
                  {feed.lastFetchedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Last fetched{" "}
                      {new Date(feed.lastFetchedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-x-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importFeed.mutate({ id: feed.id })}
                    disabled={importFeed.isPending}
                  >
                    {importFeed.isPending ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Import now
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => deleteFeed.mutate({ id: feed.id })}
                    disabled={deleteFeed.isPending}
                  >
                    <TrashIcon className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ExperimentsCard = () => {
  const utils = trpc.useUtils();
  const [experiments] = trpc.growth.getExperiments.useSuspenseQuery({
    videoId: null,
  });
  const [videos] = trpc.studio.getMany.useSuspenseQuery({ limit: 50 });

  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [variantATitle, setVariantATitle] = useState("");
  const [variantBTitle, setVariantBTitle] = useState("");

  const createExperiment = trpc.growth.createExperiment.useMutation({
    onSuccess: () => {
      utils.growth.getExperiments.invalidate({ videoId: null });
      toast.success("Experiment created");
      setVideoId(null);
      setTitle("");
      setVariantATitle("");
      setVariantBTitle("");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConicalIcon className="size-4 text-muted-foreground" />
          A/B tests
        </CardTitle>
        <CardDescription>
          Test two title variants to see which performs better.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!videoId) return;
            createExperiment.mutate({
              videoId,
              title: title.trim() || "Title test",
              variantA: { title: variantATitle.trim() },
              variantB: { title: variantBTitle.trim() },
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="flex flex-col gap-y-2">
            <Label>Video</Label>
            <Select
              value={videoId ?? "none"}
              onValueChange={(next) => setVideoId(next === "none" ? null : next)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a video" />
              </SelectTrigger>
              <SelectContent>
                {videos.items.map((video) => (
                  <SelectItem key={video.id} value={video.id}>
                    {video.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="experiment-title">Test name</Label>
            <Input
              id="experiment-title"
              placeholder="Title A/B test"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="variant-a">Variant A title</Label>
            <Input
              id="variant-a"
              placeholder="Original title"
              value={variantATitle}
              onChange={(e) => setVariantATitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="variant-b">Variant B title</Label>
            <Input
              id="variant-b"
              placeholder="Alternative title"
              value={variantBTitle}
              onChange={(e) => setVariantBTitle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={
                !videoId ||
                !variantATitle.trim() ||
                !variantBTitle.trim() ||
                createExperiment.isPending
              }
            >
              {createExperiment.isPending ? (
                <Loader2Icon className="animate-spin" />
              ) : null}
              New test
            </Button>
          </div>
        </form>

        {experiments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No A/B tests yet. Create one to compare two title variants.
          </p>
        ) : (
          <div className="flex flex-col gap-y-2">
            {experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="flex items-center justify-between gap-x-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium line-clamp-1">
                    {experiment.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {experiment.video.title}
                  </p>
                </div>
                <div className="flex items-center gap-x-2 shrink-0">
                  <Badge variant="outline">A · {experiment.viewsA}</Badge>
                  <Badge variant="outline">B · {experiment.viewsB}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};