import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { SearchInput } from "./search-input";
import { AuthButton } from "@/modules/auth/ui/components/auth-button";
import { NotificationsBell } from "@/modules/notifications/ui/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";

export const HomeNavbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-background border-b flex items-center px-2 pr-5 z-50">
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center flex-shrink-0">
          <SidebarTrigger />
          <Link prefetch href="/">
            <p className="text-xl font-semibold tracking-tight">Courant</p>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="flex-1 flex justify-center max-w-[720px] mx-auto">
          <SearchInput />
        </div>

        <div className="flex-shrink-0 items-center flex gap-4">
          <NotificationsBell />
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};
