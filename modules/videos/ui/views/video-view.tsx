import { SuggestionsSection } from "../sections/suggestions-section";
import { VideoSection } from "../sections/video-section";
import { CommentsSection } from "../sections/comments-section";
import { ChaptersSection } from "../sections/chapters-section";
import { TranscriptSection } from "../sections/transcript-section";
import { VideoSearchSection } from "../sections/video-search-section";
import { VideoActionsRow } from "../components/video-actions-row";
import { ClipButton } from "../components/clip-button";
import { HotspotsOverlay } from "../components/hotspots-overlay";
import { SaveOfflineButton } from "../components/save-offline-button";

interface VideoViewProps {
  videoId: string;
}

export const VideoView = ({ videoId }: VideoViewProps) => {
  return (
    <div className="flex flex-col max-w-[1700px] mx-auto pt-2.5 px-4 mb-10">
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <VideoSection videoId={videoId} />
          <VideoActionsRow videoId={videoId} />
          <SaveOfflineButton videoId={videoId} />
          <HotspotsOverlay videoId={videoId} />
          <ClipButton videoId={videoId} />
          <div className="xl:hidden block mt-4">
            <SuggestionsSection videoId={videoId} isManual />
          </div>
          <VideoSearchSection videoId={videoId} />
          <ChaptersSection videoId={videoId} />
          <TranscriptSection videoId={videoId} />
          <CommentsSection videoId={videoId} />
        </div>
        <div className="hidden xl:block w-full xl:w-[380px] 2xl:w-[460px] shrink-1">
          <SuggestionsSection videoId={videoId} />
        </div>
      </div>
    </div>
  );
};
