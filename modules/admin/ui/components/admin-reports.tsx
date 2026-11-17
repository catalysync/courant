"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { formatDistanceToNow } from "date-fns";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const AdminReports = () => {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Review and resolve user reports.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <ErrorBoundary fallback={<p className="text-muted-foreground">Error</p>}>
          <ReportsList />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
};

const ReportsList = () => {
  const utils = trpc.useUtils();
  const [reports] = trpc.reports.getMany.useSuspenseQuery();

  const resolve = trpc.reports.resolve.useMutation({
    onSuccess: () => utils.reports.getMany.invalidate(),
  });

  if (!reports.length) {
    return <p className="text-sm text-muted-foreground">No open reports. 🎉</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{r.reason}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(r.createdAt, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
              >
                <XIcon className="size-4 mr-1" />
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolve.mutate({ id: r.id, status: "resolved" })}
              >
                <CheckIcon className="size-4 mr-1" />
                Resolve
              </Button>
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {r.video && (
              <p>
                Video:{" "}
                <Link href={`/videos/${r.video.id}`} className="text-primary hover:underline">
                  {r.video.title}
                </Link>
              </p>
            )}
            {r.comment && <p>Comment: &ldquo;{r.comment.value.slice(0, 120)}&rdquo;</p>}
            <p>Reported by: {r.reporter?.name ?? "Unknown"}</p>
          </div>
        </div>
      ))}
    </div>
  );
};