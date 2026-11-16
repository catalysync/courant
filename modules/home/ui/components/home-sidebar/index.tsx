"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MainSection } from "./main-section";
import { Separator } from "@/components/ui/separator";
import { PersonalSection } from "./personal-section";
import { useSession } from "@/lib/auth-client";
import { SubscriptionsSection } from "./subscriptions-section";

export const HomeSidebar = () => {
  const { data: session } = useSession();

  return (
    <Sidebar className="pt-16 z-40 border-non" collapsible="icon">
      <SidebarContent className="bg-background">
        <MainSection />
        <Separator />
        <PersonalSection />
        {session?.user && (
          <>
            <Separator />
            <SubscriptionsSection />
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
};