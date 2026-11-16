"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { HistoryIcon, ListVideoIcon, ThumbsUpIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  {
      title: "History",
      url: "/playlists/history",
      icon: HistoryIcon,
      auth: true
  },
  {
      title: "Liked Videos",
      url: "/playlists/liked",
      icon: ThumbsUpIcon,
      auth: true
  },
  {
      title: "Playlists",
      url: "playlists",
      icon: ListVideoIcon,
      auth: true
  }
];

export const PersonalSection = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const signedIn = !!session?.user;
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel></SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                isActive={pathname === item.url}
                onClick={(e) => {
                  if (!signedIn && item.auth) {
                    e.preventDefault();
                    router.push("/sign-in");
                  }
                }}
              >
                <Link
                  prefetch
                  href={item.url}
                  className="flex items-center gap-4"
                >
                  <item.icon />
                  <span className="text-sm">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
