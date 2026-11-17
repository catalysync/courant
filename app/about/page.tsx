import type { Metadata } from "next";
import Link from "next/link";
import {
  BanIcon,
  BarChart3Icon,
  CircleDollarSignIcon,
  LockKeyholeIcon,
  MessagesSquareIcon,
  PlayIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About · Courant",
  description:
    "Your video universe. Built for creators, not ads — privacy, review, commerce, and analytics on your own terms.",
};

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}

const features: Feature[] = [
  {
    icon: <LockKeyholeIcon className="size-5" />,
    title: "Privacy & access control",
    description:
      "Passwords, domain gating, and unlisted links. Every video is exactly as private as you need it to be.",
    accent: "bg-sky-500/15 text-sky-400",
  },
  {
    icon: <MessagesSquareIcon className="size-5" />,
    title: "Client review",
    description:
      "Timecoded comments and full version history turn scattered feedback into a clean, threaded loop.",
    accent: "bg-violet-500/15 text-violet-400",
  },
  {
    icon: <CircleDollarSignIcon className="size-5" />,
    title: "Creator commerce",
    description:
      "Tips, memberships, and rentals built in. Keep the revenue — there are no ads and no middlemen.",
    accent: "bg-emerald-500/15 text-emerald-400",
  },
  {
    icon: <UsersIcon className="size-5" />,
    title: "Real-time watch parties",
    description:
      "Watch together in sync with live chat and shared playlists, whether it's ten friends or ten thousand fans.",
    accent: "bg-rose-500/15 text-rose-400",
  },
  {
    icon: <SparklesIcon className="size-5" />,
    title: "AI suite",
    description:
      "Instant chapters, transcripts, and semantic search that let your audience find the exact moment they need.",
    accent: "bg-amber-500/15 text-amber-400",
  },
  {
    icon: <BarChart3Icon className="size-5" />,
    title: "Deep analytics",
    description:
      "Retention curves and geography that show you how your audience actually watches — not just views.",
    accent: "bg-cyan-500/15 text-cyan-400",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-teal-400">
              <PlayIcon className="size-3.5 fill-white text-white" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Courant
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-240px] h-[520px] w-[880px] max-w-none -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(59,130,246,0.28),transparent)] blur-2xl" />
          <div className="absolute left-[12%] top-10 h-[320px] w-[320px] rounded-full bg-[radial-gradient(closest-side,rgba(20,184,166,0.18),transparent)] blur-3xl" />
          <div className="absolute right-[10%] top-20 h-[280px] w-[280px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.18),transparent)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-teal-400" />
            Built for creators, not ads
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
            Your video{" "}
            <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-teal-300 bg-clip-text text-transparent">
              universe
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Upload, share, and get paid on your own terms. Courant gives
            creators and teams the privacy, review, and monetization tools that
            ad-driven platforms never will.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up">Start creating</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/feed/trending">Explore</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a creator needs, nothing they don't
          </h2>
          <p className="mt-4 text-muted-foreground">
            A focused toolset for people who make things — and want to own how
            it's shared and sold.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border bg-card/50 p-6 transition-colors hover:border-border hover:bg-card"
            >
              <div
                className={`flex size-11 items-center justify-center rounded-xl ${feature.accent}`}
              >
                {feature.icon}
              </div>
              <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* No ads band */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-background p-8 sm:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-[-80px] top-[-80px] h-[280px] w-[280px] rounded-full bg-[radial-gradient(closest-side,rgba(20,184,166,0.16),transparent)] blur-2xl" />
          </div>

          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400">
                <BanIcon className="size-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  No ads, ever
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  No pre-rolls, no mid-rolls, no algorithm chasing clicks. Your
                  audience pays attention to you — not to ads.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/sign-up">Make it yours</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>© 2026 Courant. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="transition-colors hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}