"use client";

import { BrandingSection } from "../sections/branding-section";

export const BrandingView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Branding</h1>
        <p className="text-xs text-muted-foreground">
          Customize how your channel looks to viewers
        </p>
      </div>
      <BrandingSection />
    </div>
  );
};