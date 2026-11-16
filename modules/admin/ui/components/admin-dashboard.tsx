"use client";

import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2Icon } from "lucide-react";

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en");

export const AdminDashboard = () => {
  const { data, isLoading } = trpc.admin.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const watchHours = Math.round((data?.watchSeconds ?? 0) / 3600);

  const stats = [
    { label: "Users", value: fmt(data?.users) },
    { label: "Videos", value: fmt(data?.videos) },
    { label: "Views", value: fmt(data?.views) },
    { label: "Comments", value: fmt(data?.comments) },
    { label: "Likes & dislikes", value: fmt(data?.reactions) },
    { label: "Subscriptions", value: fmt(data?.subscriptions) },
    { label: "Watch time", value: `${watchHours.toLocaleString("en")}h` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Aggregate activity across Courant.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};