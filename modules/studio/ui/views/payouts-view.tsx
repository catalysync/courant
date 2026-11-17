"use client";

import { PayoutsSection } from "../sections/payouts-section";

export const PayoutsView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <div className="px-4">
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-xs text-muted-foreground">
          Your earnings balance and payout history
        </p>
      </div>
      <PayoutsSection />
    </div>
  );
};