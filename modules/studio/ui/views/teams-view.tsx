"use client";

import { TeamsSection } from "../sections/teams-section";

export const TeamsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-xs text-muted-foreground">
          Manage your teams and members
        </p>
      </div>
      <TeamsSection />
    </div>
  );
};