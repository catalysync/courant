"use client";

import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ClapperboardIcon, UserCircleIcon, UserIcon } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const AuthButton = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  if (isPending) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />;
  }

  const user = session?.user;

  if (!user) {
    return (
      <Button
        variant="outline"
        className="px-4 py-2 text-sm text-teal-400 hover:text-teal-500 border-teal-500/20 rounded-full shadow-none"
        onClick={() => router.push("/sign-in")}
      >
        <UserCircleIcon />
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar size="lg" imageUrl={user.image ?? null} name={user.name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/users/current">
            <UserIcon className="size-4 mr-2" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/studio">
            <ClapperboardIcon className="size-4 mr-2" />
            Studio
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.refresh() } })}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};