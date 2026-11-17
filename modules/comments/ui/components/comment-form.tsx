"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3Icon, XIcon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useSession } from "@/lib/auth-client";
import { getPlaybackTime, formatTime } from "@/lib/playback-time";

interface CommentFormProps {
  videoId: string;
  parentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  variant?: "comment" | "reply";
}

const formSchema = z.object({
  parentId: z.string().uuid().nullish(),
  videoId: z.string().uuid(),
  value: z.string().min(1),
  timestampSec: z.number().min(0).max(100000).nullish(),
});

export const CommentForm = ({
  videoId,
  parentId,
  onCancel,
  onSuccess,
  variant = "comment",
}: CommentFormProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const [timestampSec, setTimestampSec] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const create = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.getMany.invalidate({ videoId });
      utils.comments.getMany.invalidate({ videoId, parentId });
      form.reset();
      toast.success("Comment added");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Something went wrong");
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parentId,
      videoId,
      value: "",
      timestampSec: null,
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    create.mutate({ ...values, timestampSec: timestampSec ?? null });
  };

  const handleCancel = () => {
    form.reset();
    setTimestampSec(null);
    onCancel?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex gap-4 group">
        <UserAvatar size="lg" imageUrl={user?.image ?? null} name={user?.name ?? "User"} />
        <div className="flex-1">
          <FormField
            name="value"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={variant === "reply" ? "Reply to this comment..." : "Add a comment..."}
                    className="resize-none bg-transparent overflow-hidden min-h-0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2">
              {timestampSec === null ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimestampSec(Math.max(0, getPlaybackTime()))}
                >
                  <Clock3Icon className="size-4 mr-1" />
                  {formatTime(getPlaybackTime())}
                </Button>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                  <Clock3Icon className="size-3" />
                  {formatTime(timestampSec)}
                  <button
                    type="button"
                    onClick={() => setTimestampSec(null)}
                    className="ml-0.5 hover:text-blue-900"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="ghost" type="button" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
              <Button disabled={create.isPending} type="submit" size="sm">
                {variant === "reply" ? "Reply" : "Comment"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
};