"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import {
  FlameIcon,
  HistoryIcon,
  HomeIcon,
  NewspaperIcon,
  PlaySquareIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  {
    title: "Home",
    url: "/",
    icon: HomeIcon,
  },
  {
    title: "Following",
    url: "/feed/subscriptions",
    icon: PlaySquareIcon,
    auth: true,
  },
  {
    title: "Following posts",
    url: "/feed/following",
    icon: NewspaperIcon,
    auth: true,
  },
  {
    title: "The Buzz",
    url: "/feed/trending",
    icon: FlameIcon,
  },
  {
    title: "History",
    url: "/feed/history",
    icon: HistoryIcon,
    auth: true,
  },
];

export const MainSection = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const signedIn = !!session?.user;
  return (
    <SidebarGroup>
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
