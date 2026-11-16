import { UsersTable } from "@/modules/admin/ui/components/users-table";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage accounts, roles and moderation.
        </p>
      </div>
      <UsersTable />
    </div>
  );
}