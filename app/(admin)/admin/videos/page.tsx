import { VideosTable } from "@/modules/admin/ui/components/videos-table";

export const dynamic = "force-dynamic";

export default function AdminVideosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="text-sm text-muted-foreground">
          Content moderation across the platform.
        </p>
      </div>
      <VideosTable />
    </div>
  );
}