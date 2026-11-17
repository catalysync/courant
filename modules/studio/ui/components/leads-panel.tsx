"use client";

import { Suspense } from "react";
import { toast } from "sonner";
import { DownloadIcon, MailIcon } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeadsPanelProps {
  videoId: string;
}

export const LeadsPanel = ({ videoId }: LeadsPanelProps) => {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <LeadsPanelSuspense videoId={videoId} />
      </ErrorBoundary>
    </Suspense>
  );
};

const LeadsPanelSuspense = ({ videoId }: LeadsPanelProps) => {
  const [leads] = trpc.leads.getMany.useSuspenseQuery({ videoId });
  const { data: exportRows } = trpc.leads.exportCsv.useQuery({ videoId });

  const onDownload = () => {
    const rows = exportRows ?? [];
    if (rows.length === 0) {
      toast.info("No leads to export");
      return;
    }

    const escape = (value: string | null) => {
      const text = value ?? "";
      return `"${text.replace(/"/g, '""')}"`;
    };

    const lines = [
      ["email", "name", "createdAt", "title"].join(","),
      ...rows.map((row) =>
        [
          row.email,
          row.name ?? "",
          new Date(row.createdAt).toISOString(),
          row.title,
        ]
          .map(escape)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `leads-${videoId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MailIcon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Leads</h2>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onDownload}>
          <DownloadIcon className="size-4 mr-2" />
          Download CSV
        </Button>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads yet. Emails collected from the email gate will show up here.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>{lead.email}</TableCell>
                <TableCell>{lead.name ?? "—"}</TableCell>
                <TableCell>
                  {new Date(lead.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};