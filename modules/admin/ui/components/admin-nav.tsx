"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const links = [
  { title: "Dashboard", url: "/admin" },
  { title: "Users", url: "/admin/users" },
  { title: "Videos", url: "/admin/videos" },
  { title: "Reports", url: "/admin/reports" },
];

export const AdminNav = () => {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => (
        <Link
          key={link.url}
          href={link.url}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground",
            (pathname === link.url ||
              (link.url !== "/admin" && pathname.startsWith(link.url))) &&
              "bg-muted text-foreground",
          )}
        >
          {link.title}
        </Link>
      ))}
      <button
        className="ml-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground"
        onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}
      >
        Sign out
      </button>
    </nav>
  );
};