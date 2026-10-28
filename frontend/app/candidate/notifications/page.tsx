import AuthGuard from "../../components/AuthGuard";
import NotificationCenter from "../../components/notifications/NotificationCenter";
export default function NotificationsPage() {
  return <AuthGuard allowedRoles={["candidate"]}><NotificationCenter role="candidate" /></AuthGuard>;
}
