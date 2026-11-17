import { VideosSection } from "../sections/videos-section";
import { OverviewSection } from "../sections/overview-section";

export const StudioView = () => {
  return (
    <div className="pt-2.5 flex flex-col gap-y-6">
      <OverviewSection />
      <div className="px-4">
        <h1 className="text-3xl font-bold">Channel content</h1>
        <p className="text-xs text-muted-foreground">
          Manage your channel content and videos
        </p>
      </div>
      <VideosSection />
    </div>
  );
};
