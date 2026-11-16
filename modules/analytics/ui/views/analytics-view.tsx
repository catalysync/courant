"use client";

import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
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

export const AnalyticsView = () => {
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
          <CardHeader>
            <CardTitle>Views — last 30 days</CardTitle>
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
    </div>
  );
};