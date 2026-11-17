"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { DownloadIcon, WalletIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type LedgerType = "tip_received" | "payout" | "adjustment";

type LedgerEntry = {
  id: string;
  type: LedgerType;
  amountCents: number;
  balanceCents: number;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: Date | string;
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatSignedCents = (cents: number) =>
  `${cents >= 0 ? "+" : "-"}$${(Math.abs(cents) / 100).toFixed(2)}`;

const typeLabel: Record<LedgerType, string> = {
  tip_received: "Tip received",
  payout: "Payout",
  adjustment: "Adjustment",
};

const csvEscape = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const downloadCsv = (entries: LedgerEntry[]) => {
  const header = ["date", "type", "amount", "balance", "note"];
  const rows = entries.map((entry) => [
    new Date(entry.createdAt).toISOString(),
    entry.type,
    (entry.amountCents / 100).toFixed(2),
    (entry.balanceCents / 100).toFixed(2),
    entry.note ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "payout-history.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const PayoutsSection = () => {
  return (
    <Suspense fallback={<PayoutsSectionSkeleton />}>
      <ErrorBoundary
        fallback={
          <div className="py-8 text-center text-sm text-muted-foreground">
            Something went wrong
          </div>
        }
      >
        <PayoutsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const PayoutsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Skeleton className="h-36 w-full max-w-sm" />
      <div className="flex flex-col gap-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
};

const PayoutsSectionSuspense = () => {
  const [ledger] = trpc.tips.getLedger.useSuspenseQuery();
  const { balanceCents, entries } = ledger;

  const handleDownload = () => {
    downloadCsv(entries);
    toast.success("Downloaded payout history");
  };

  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available balance
            </CardTitle>
            <p className="text-3xl font-bold tabular-nums">
              {formatCents(balanceCents)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <DownloadIcon className="size-4" />
            Download CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <p className="text-xs text-muted-foreground">
            Payouts are manual for now — contact support to request a
            withdrawal.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Payout history
        </h2>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-y-2 rounded-xl border border-dashed py-12 text-center">
            <WalletIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No payout history yet</p>
            <p className="text-xs text-muted-foreground">
              Your earnings and withdrawals will show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-2">
            {entries.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LedgerRow = ({ entry }: { entry: LedgerEntry }) => {
  const isCredit = entry.amountCents >= 0;

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Badge variant="secondary">{typeLabel[entry.type]}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-1">
            {entry.note ?? typeLabel[entry.type]}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(entry.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-y-1">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              isCredit ? "text-emerald-500" : "text-red-500",
            )}
          >
            {formatSignedCents(entry.amountCents)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Balance {formatCents(entry.balanceCents)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};