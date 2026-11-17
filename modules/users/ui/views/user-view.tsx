import { ChannelPostsSection } from "@/modules/community/ui/sections/channel-posts-section";
import { ChannelBrandingBanner } from "@/modules/branding/ui/components/channel-branding-banner";
import { PublicPlaylistsSection } from "@/modules/playlists/ui/sections/public-playlists-section";

import { UserSection } from "../sections/user-section";
import { VideosSection } from "../sections/videos-section";

interface UserViewProps {
  userId: string;
}

export const UserView = ({ userId }: UserViewProps) => {
  return (
    <div className="flex flex-col max-w-[1300px] mx-auto pt-2.5 px-4 mb-10 gap-y-6">
      <ChannelBrandingBanner userId={userId} />
      <UserSection userId={userId} />
      <VideosSection userId={userId} />
      <PublicPlaylistsSection userId={userId} />
      <section className="flex flex-col gap-y-4 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold">Posts</h2>
          <p className="text-xs text-muted-foreground">Updates from this channel</p>
        </div>
        <ChannelPostsSection userId={userId} />
      </section>
    </div>
  );
};
