"use client";

import { TipsSection } from "../sections/tips-section";

export const TipsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Tips</h1>
        <p className="text-xs text-muted-foreground">
          Support from your viewers and tips you&apos;ve sent
        </p>
      </div>
      <TipsSection />
    </div>
  );
};