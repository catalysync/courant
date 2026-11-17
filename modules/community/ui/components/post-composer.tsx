"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3Icon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react";

import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";

interface PostComposerProps {
  userId: string;
}

const MAX_POLL_OPTIONS = 6;

export const PostComposer = ({ userId }: PostComposerProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const utils = trpc.useUtils();

  const [text, setText] = useState("");
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const create = trpc.community.createPost.useMutation({
    onSuccess: () => {
      utils.community.getChannelPosts.invalidate({ userId });
      setText("");
      setShowPoll(false);
      setPollOptions(["", ""]);
      toast.success("Post published");
    },
    onError: (error) => {
      toast.error("Something went wrong");
      if (error.data?.code === "UNAUTHORIZED") {
        router.push("/sign-in");
      }
    },
  });

  // Only the channel owner can create posts on this channel.
  if (!user || user.id !== userId) return null;

  const validOptions = showPoll
    ? pollOptions.map((option) => option.trim()).filter(Boolean)
    : [];
  const canPost = text.trim().length > 0 || validOptions.length > 0;

  const addOption = () =>
    setPollOptions((prev) => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, ""]));

  const removeOption = (index: number) =>
    setPollOptions((prev) => prev.filter((_, i) => i !== index));

  const updateOption = (index: number, value: string) =>
    setPollOptions((prev) => prev.map((option, i) => (i === index ? value : option)));

  const handlePost = () => {
    const isPoll = validOptions.length > 0;
    create.mutate({
      type: isPoll ? "poll" : "text",
      text: text.trim() || null,
      pollOptions: isPoll ? validOptions : null,
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <UserAvatar imageUrl={user.image} name={user.name} />
          <div className="flex-1 min-w-0">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share something with your community..."
              maxLength={2000}
              className="resize-none border-none shadow-none focus-visible:ring-0 p-0 min-h-[60px]"
            />

            {showPoll && (
              <div className="flex flex-col gap-y-2 mt-3">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      maxLength={120}
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={addOption}
                  >
                    <PlusIcon className="size-4 mr-1" />
                    Add option
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPoll((current) => !current)}
              >
                <BarChart3Icon className="size-4 mr-1" />
                Poll
              </Button>
              <Button size="sm" disabled={!canPost || create.isPending} onClick={handlePost}>
                <SendIcon className="size-4 mr-1" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};