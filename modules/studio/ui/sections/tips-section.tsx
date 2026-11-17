"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CircleDollarSignIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Direction = "received" | "sent";

export const TipsSection = () => {
  return (
    <Suspense fallback={<TipsSectionSkeleton />}>
      <ErrorBoundary fallback={<p>Error...</p>}>
        <TipsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const TipsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Skeleton className="h-32 w-full max-w-sm" />
      <div className="flex flex-col gap-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
};

const TipsSectionSuspense = () => {
  const [ledger] = trpc.tips.getLedger.useSuspenseQuery();

  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">
            {formatCents(ledger.balanceCents)}
          </p>
        </CardContent>
      </Card>

      <TipsTabs />
    </div>
  );
};

const TipsTabs = () => {
  return (
    <Tabs defaultValue="received">
      <TabsList>
        <TabsTrigger value="received">Received</TabsTrigger>
        <TabsTrigger value="sent">Sent</TabsTrigger>
      </TabsList>
      <TabsContent value="received">
        <Suspense fallback={<TipsListSkeleton />}>
          <TipsList direction="received" />
        </Suspense>
      </TabsContent>
      <TabsContent value="sent">
        <Suspense fallback={<TipsListSkeleton />}>
          <TipsList direction="sent" />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
};

const TipsListSkeleton = () => {
  return (
    <div className="mt-4 flex flex-col gap-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
};

const TipsList = ({ direction }: { direction: Direction }) => {
  const [tips] = trpc.tips.getMany.useSuspenseQuery({ direction });

  if (tips.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-y-2 rounded-xl border border-dashed py-12 text-center">
        <CircleDollarSignIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          No {direction === "received" ? "received" : "sent"} tips yet
        </p>
        <p className="text-xs text-muted-foreground">
          {direction === "received"
            ? "Tips from your viewers will show up here."
            : "Tips you send to creators will show up here."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-y-2">
      {tips.map((tip) => (
        <Card key={tip.id}>
          <CardContent className="flex items-center gap-3 p-4">
            <UserAvatar
              size="default"
              imageUrl={tip.user.image}
              name={tip.user.name}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-1">{tip.user.name}</p>
              {tip.note && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {tip.note}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-y-1">
              <p className="text-sm font-semibold tabular-nums">
                {formatCents(tip.amountCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(tip.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};