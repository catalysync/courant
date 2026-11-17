"use client";

import { SettingsSection } from "../sections/settings-section";

export const SettingsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Monetization and player settings for your channel
        </p>
      </div>
      <SettingsSection />
    </div>
  );
};