import { CategoriesSection } from "../sections/categories-section";
import { FeaturedSection } from "../sections/featured-section";
import { HomeSubscriptionsSection } from "../sections/home-subscriptions-section";
import { HomeTrendingSection } from "../sections/home-trending-section";
import { LiveSection } from "../sections/live-section";
import { VideosSection } from "../sections/videos-section";
import { ContinueWatchingSection } from "../sections/continue-watching-section";

interface HomeViewProps {
  categoryId?: string;
}

export const HomeView = ({ categoryId }: HomeViewProps) => {
  return (
    <div className="max-w-[2400px] mx-auto mb-10 px-4 pt-2.5 flex flex-col gap-y-6">
      <FeaturedSection />
      <ContinueWatchingSection />
      <HomeTrendingSection />
      <HomeSubscriptionsSection />
      <LiveSection />
      <CategoriesSection categoryId={categoryId} />
      <VideosSection categoryId={categoryId} />
    </div>
  );
};