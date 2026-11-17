"use client";

import { GrowthSection } from "../sections/growth-section";

export const GrowthView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Growth</h1>
        <p className="text-xs text-muted-foreground">
          Import videos, RSS feeds, and A/B tests to grow your channel
        </p>
      </div>
      <GrowthSection />
    </div>
  );
};