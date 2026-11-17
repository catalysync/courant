"use client";

import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en");

const fmtDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const AUDIENCE_DAYS = 30;

export const AnalyticsView = () => {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const overview = trpc.analytics.getOverview.useQuery();
  const topVideos = trpc.analytics.getTopVideos.useQuery();
  const viewsOverTime = trpc.analytics.getViewsOverTime.useQuery({ days: 30 });

  if (overview.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    { label: "Total views", value: fmt(overview.data?.views) },
    { label: "Watch time", value: fmtDuration(overview.data?.watchSeconds ?? 0) },
    { label: "Likes", value: fmt(overview.data?.likes) },
    { label: "Comments", value: fmt(overview.data?.comments) },
    { label: "Subscribers", value: fmt(overview.data?.subscribers) },
    { label: "Videos", value: fmt(overview.data?.videos) },
  ];

  const exportViewsCsv = () => {
    const rows = viewsOverTime.data ?? [];
    const csv = ["date,count", ...rows.map((r) => `${r.date},${r.count}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `views-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Channel analytics</h1>
        <p className="text-sm text-muted-foreground">How your content is performing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Views — last 30 days</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={exportViewsCsv}
              disabled={!viewsOverTime.data?.length}
            >
              <DownloadIcon />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={viewsOverTime.data ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top videos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topVideos.data?.map((video, i) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="flex items-start gap-3 group"
              >
                <span className="text-sm text-muted-foreground font-semibold w-5">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1 group-hover:text-primary">
                    {video.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(video.viewCount)} views · {fmt(video.likeCount)} likes ·{" "}
                    {fmt(video.commentCount)} comments
                  </p>
                </div>
              </Link>
            ))}
            {topVideos.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No videos yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Suspense fallback={<Skeleton className="h-10 w-full max-w-sm" />}>
        <ErrorBoundary fallback={null}>
          <VideoPicker value={selectedVideoId} onValueChange={setSelectedVideoId} />
        </ErrorBoundary>
      </Suspense>

      {selectedVideoId && (
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <ErrorBoundary fallback={<p>Error...</p>}>
            <RetentionSection videoId={selectedVideoId} />
          </ErrorBoundary>
        </Suspense>
      )}

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ErrorBoundary fallback={<p>Error...</p>}>
          <AudienceSection videoId={selectedVideoId} />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
};

const VideoPicker = ({
  value,
  onValueChange,
}: {
  value: string | null;
  onValueChange: (id: string | null) => void;
}) => {
  const [data] = trpc.studio.getMany.useSuspenseQuery({ limit: 100 });
  const videos = data.items;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-sm font-medium">Video</span>
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onValueChange(v === "all" ? null : v)}
      >
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All videos</SelectItem>
          {videos.map((video) => (
            <SelectItem key={video.id} value={video.id}>
              {video.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const RetentionSection = ({ videoId }: { videoId: string }) => {
  const [points] = trpc.analytics.getRetention.useSuspenseQuery({ videoId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audience retention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {points.map((point) => (
          <div key={point.percent} className="flex items-center gap-3">
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {point.percent}%
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded bg-primary"
                style={{ width: `${point.retentionPct}%` }}
              />
            </div>
            <span className="w-12 text-xs text-muted-foreground tabular-nums">
              {point.retentionPct}%
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const AudienceSection = ({ videoId }: { videoId: string | null }) => {
  const [geography] = trpc.analytics.getGeography.useSuspenseQuery({
    videoId: videoId ?? undefined,
    days: AUDIENCE_DAYS,
  });
  const [devices] = trpc.analytics.getDevices.useSuspenseQuery({
    videoId: videoId ?? undefined,
    days: AUDIENCE_DAYS,
  });
  const [referrers] = trpc.analytics.getReferrers.useSuspenseQuery({
    videoId: videoId ?? undefined,
    days: AUDIENCE_DAYS,
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AudienceListCard
        title="Geography"
        items={geography.map((r) => ({ key: r.key.toUpperCase(), n: r.n }))}
      />
      <AudienceListCard
        title="Devices"
        items={devices.map((r) => ({ key: capitalize(r.key), n: r.n }))}
      />
      <AudienceListCard title="Referrers" items={referrers.map((r) => ({ key: r.key, n: r.n }))} />
    </div>
  );
};

const AudienceListCard = ({
  title,
  items,
}: {
  title: string;
  items: { key: string; n: number }[];
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm truncate">{item.key}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{fmt(item.n)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};