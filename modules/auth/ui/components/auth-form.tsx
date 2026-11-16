"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "sign-in" | "sign-up";
}

export const AuthForm = ({ mode }: AuthFormProps) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "sign-up") {
        await authClient.signUp.email({ name, email, password });
      } else {
        await authClient.signIn.email({ email, password });
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Sign in to Courant to watch and upload videos."
            : "Join Courant to start uploading and sharing videos."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "sign-up" && (
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2Icon className="size-4 mr-2 animate-spin" />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? (
          <>
            No account?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
};