"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import {
  LogOutIcon,
  VideoIcon,
  BarChart3Icon,
  CircleDollarSignIcon,
  WalletIcon,
  UsersIcon,
  SettingsIcon,
  MonitorPlayIcon,
  SproutIcon,
  PaletteIcon,
  CalendarClockIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudioSidebarHeader } from "./studio-sidebar-header";

export const StudioSidebar = () => {
  const pathName = usePathname();
  return (
    <Sidebar className="pt-16 z-40" collapsible="icon">
      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarMenu>
            <StudioSidebarHeader />
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio"}
                tooltip="Content"
                asChild
              >
                <Link prefetch href="/studio">
                  <VideoIcon className="size-5" />
                  <span className="text-sm">Content</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/analytics"}
                tooltip="Analytics"
                asChild
              >
                <Link prefetch href="/studio/analytics">
                  <BarChart3Icon className="size-5" />
                  <span className="text-sm">Analytics</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/tips"}
                tooltip="Tips"
                asChild
              >
                <Link prefetch href="/studio/tips">
                  <CircleDollarSignIcon className="size-5" />
                  <span className="text-sm">Tips</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/payouts"}
                tooltip="Payouts"
                asChild
              >
                <Link prefetch href="/studio/payouts">
                  <WalletIcon className="size-5" />
                  <span className="text-sm">Payouts</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/team"}
                tooltip="Team"
                asChild
              >
                <Link prefetch href="/studio/team">
                  <UsersIcon className="size-5" />
                  <span className="text-sm">Team</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/settings"}
                tooltip="Settings"
                asChild
              >
                <Link prefetch href="/studio/settings">
                  <SettingsIcon className="size-5" />
                  <span className="text-sm">Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/presets"}
                tooltip="Player presets"
                asChild
              >
                <Link prefetch href="/studio/presets">
                  <MonitorPlayIcon className="size-5" />
                  <span className="text-sm">Player presets</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/growth"}
                tooltip="Growth"
                asChild
              >
                <Link prefetch href="/studio/growth">
                  <SproutIcon className="size-5" />
                  <span className="text-sm">Growth</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/branding"}
                tooltip="Branding"
                asChild
              >
                <Link prefetch href="/studio/branding">
                  <PaletteIcon className="size-5" />
                  <span className="text-sm">Branding</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathName === "/studio/webinars"}
                tooltip="Webinars"
                asChild
              >
                <Link prefetch href="/studio/webinars">
                  <CalendarClockIcon className="size-5" />
                  <span className="text-sm">Webinars</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <Separator />
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Exit Studio" asChild>
                <Link prefetch href="/">
                  <LogOutIcon className="size-5" />
                  <span className="text-sm">Exit Studio</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
