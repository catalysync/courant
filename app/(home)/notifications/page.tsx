import { NotificationsView } from "@/modules/notifications/ui/views/notifications-view";
import { HydrateClient, trpc } from "@/trpc/server";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  void trpc.notifications.getMany.prefetchInfinite({ limit: 20 });
  void trpc.notifications.getUnreadCount.prefetch();

  return (
    <HydrateClient>
      <NotificationsView />
    </HydrateClient>
  );
}