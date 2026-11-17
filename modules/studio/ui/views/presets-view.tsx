"use client";

import { PresetsSection } from "../sections/presets-section";

export const PresetsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Player presets</h1>
        <p className="text-xs text-muted-foreground">
          Saved player appearance presets for your videos
        </p>
      </div>
      <PresetsSection />
    </div>
  );
};