import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";
import { AdminNav } from "@/modules/admin/ui/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-50 h-14 border-b bg-background flex items-center justify-between px-4 md:px-6">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <ShieldCheckIcon className="size-5 text-teal-600" />
          Courant Admin
        </Link>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 md:px-6 py-6">{children}</main>
    </div>
  );
}