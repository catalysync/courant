"use client";

import { WebinarsSection } from "../sections/webinars-section";

export const WebinarsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Webinars</h1>
        <p className="text-xs text-muted-foreground">
          Schedule webinars and manage registrations
        </p>
      </div>
      <WebinarsSection />
    </div>
  );
};