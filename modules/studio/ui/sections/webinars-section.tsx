"use client";

import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import {
  CalendarClockIcon,
  ChevronDownIcon,
  Loader2Icon,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  scheduled: "secondary",
  live: "destructive",
  ended: "outline",
};

type Webinar = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: Date | null;
  status: string;
  registrationCount: number;
};

export const WebinarsSection = () => {
  return (
    <Suspense fallback={<WebinarsSectionSkeleton />}>
      <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
        <WebinarsSectionSuspense />
      </ErrorBoundary>
    </Suspense>
  );
};

const WebinarsSectionSkeleton = () => {
  return (
    <div className="px-4 flex flex-col gap-y-4">
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
};

const WebinarsSectionSuspense = () => {
  const utils = trpc.useUtils();
  const [webinars] = trpc.webinars.getMyWebinars.useSuspenseQuery();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const create = trpc.webinars.create.useMutation({
    onSuccess: () => {
      utils.webinars.getMyWebinars.invalidate();
      toast.success("Webinar created");
      setTitle("");
      setDescription("");
      setScheduledAt("");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="px-4 flex flex-col gap-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            New webinar
          </CardTitle>
          <CardDescription>
            Schedule a live webinar and collect registrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({
                title: title.trim(),
                description: description.trim() ? description.trim() : null,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
              });
            }}
            className="flex flex-col gap-y-4"
          >
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="webinar-title">Title</Label>
              <Input
                id="webinar-title"
                placeholder="Webinar title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="webinar-description">Description</Label>
              <Textarea
                id="webinar-description"
                placeholder="What will you cover?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
                maxLength={2000}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="webinar-date">Date &amp; time (optional)</Label>
              <Input
                id="webinar-date"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div>
              <Button
                type="submit"
                disabled={!title.trim() || create.isPending}
              >
                {create.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                Create webinar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {webinars.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-y-2 py-12 text-center">
            <CalendarClockIcon className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No webinars yet</p>
            <p className="text-xs text-muted-foreground">
              Create a webinar to start collecting registrations.
            </p>
          </CardContent>
        </Card>
      ) : (
        webinars.map((webinar) => (
          <WebinarCard key={webinar.id} webinar={webinar} />
        ))
      )}
    </div>
  );
};

const WebinarCard = ({ webinar }: { webinar: Webinar }) => {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const deleteWebinar = trpc.webinars.delete.useMutation({
    onSuccess: () => {
      utils.webinars.getMyWebinars.invalidate();
      toast.success("Webinar deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-x-2">
          <div className="flex items-center gap-x-3 min-w-0">
            <CardTitle className="truncate">{webinar.title}</CardTitle>
            <Badge variant={statusVariant[webinar.status] ?? "secondary"}>
              {webinar.status}
            </Badge>
          </div>
          <div className="flex items-center gap-x-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((prev) => !prev)}
            >
              {webinar.registrationCount}{" "}
              {webinar.registrationCount === 1 ? "registrant" : "registrants"}
              <ChevronDownIcon
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-180",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => deleteWebinar.mutate({ id: webinar.id })}
              disabled={deleteWebinar.isPending}
            >
              <TrashIcon className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
        {webinar.description ? (
          <CardDescription className="line-clamp-2">
            {webinar.description}
          </CardDescription>
        ) : null}
        <CardDescription>
          {webinar.scheduledAt
            ? new Date(webinar.scheduledAt).toLocaleString()
            : "No date scheduled"}
        </CardDescription>
      </CardHeader>

      {open ? (
        <>
          <Separator />
          <CardContent className="pt-6">
            <Suspense fallback={<RegistrationsSkeleton />}>
              <ErrorBoundary fallback={<div className="py-8 text-center text-sm text-muted-foreground">Something went wrong</div>}>
                <Registrations webinarId={webinar.id} />
              </ErrorBoundary>
            </Suspense>
          </CardContent>
        </>
      ) : null}
    </Card>
  );
};

const RegistrationsSkeleton = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
};

const Registrations = ({ webinarId }: { webinarId: string }) => {
  const [registrations] = trpc.webinars.getRegistrations.useSuspenseQuery({
    webinarId,
  });

  if (registrations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No registrations yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <p className="text-sm font-medium">Registrations</p>
      <div className="flex flex-col gap-y-1">
        {registrations.map((registration) => (
          <div
            key={registration.id}
            className="flex items-center justify-between gap-x-3 py-1.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {registration.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {registration.email}
              </p>
            </div>
            <p className="text-xs text-muted-foreground shrink-0">
              {new Date(registration.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};