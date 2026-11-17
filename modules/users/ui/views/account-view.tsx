"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const AccountView = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await authClient.updateUser({ name: name.trim() || undefined });
      toast.success("Account updated");
    } catch (e: any) {
      toast.error(e?.message || "Could not update account");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete your account? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await authClient.deleteUser({});
      toast.success("Account deleted");
      router.push("/");
    } catch (e: any) {
      toast.error(e?.message || "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return <p className="p-6 text-muted-foreground">Sign in to manage your account.</p>;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and account.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Email</Label>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving && <Loader2Icon className="size-4 mr-2 animate-spin" />}
        Save
      </Button>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-destructive">Danger zone</p>
        <Button variant="destructive" onClick={remove} disabled={deleting}>
          {deleting && <Loader2Icon className="size-4 mr-2 animate-spin" />}
          Delete account
        </Button>
      </div>
    </div>
  );
};