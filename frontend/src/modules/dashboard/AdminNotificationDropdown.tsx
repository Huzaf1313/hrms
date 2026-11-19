import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Box,
  Check,
  CheckCheck,
  Clock,
  LifeBuoy,
  LogOut,
  Ticket,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { adminNotificationService } from "./adminNotificationService";
import type { EmployeeNotification } from "./notificationTypes";

interface AdminNotificationDropdownProps {
  onUnreadCountChange?: (count: number) => void;
  /** Lifts the current count up to the header so the badge and this list can
   *  never drift apart. */
  onRefreshRequest?: () => void;
  onClose?: () => void;
}

type IconSpec = { icon: typeof Bell; className: string };

/** Notification types raised by employee actions, each with its own colour. */
const TYPE_STYLES: Record<string, IconSpec> = {
  leave_requested: { icon: Clock, className: "bg-purple-50 text-purple-600" },
  support_ticket_raised: {
    icon: LifeBuoy,
    className: "bg-rose-50 text-rose-600",
  },
  regularization_requested: {
    icon: Clock,
    className: "bg-amber-50 text-amber-600",
  },
  resignation_submitted: {
    icon: LogOut,
    className: "bg-gray-100 text-gray-600",
  },
  asset_requested: { icon: Box, className: "bg-blue-50 text-blue-600" },
};

const FALLBACK_ICON: IconSpec = {
  icon: Ticket,
  className: "bg-blue-50 text-blue-600",
};

function getIconSpec(type: string): IconSpec {
  const normalized = type.toLowerCase();

  const match = Object.keys(TYPE_STYLES).find((key) =>
    normalized.includes(key),
  );

  return (match && TYPE_STYLES[match]) || FALLBACK_ICON;
}

function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminNotificationDropdown({
  onUnreadCountChange,
  onRefreshRequest,
  onClose,
}: AdminNotificationDropdownProps) {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<EmployeeNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const applyUnreadCount = useCallback(
    (count: number) => {
      setUnreadCount(count);
      onUnreadCountChange?.(count);
    },
    [onUnreadCountChange],
  );

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await adminNotificationService.getNotifications({
        page: 1,
        limit: 20,
      });

      setNotifications(response.notifications);
      applyUnreadCount(response.unread_count);
    } catch (error) {
      console.error("Failed to load admin notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [applyUnreadCount]);

  useEffect(() => {
    // Reading notifications from the API when the dropdown opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleNotificationClick(notification: EmployeeNotification) {
    try {
      if (!notification.is_read) {
        setProcessingId(notification.id);

        await adminNotificationService.markAsRead(notification.id);

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? {
                  ...item,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : item,
          ),
        );

        applyUnreadCount(Math.max(0, unreadCount - 1));
      }

      onClose?.();

      // Re-sync on the way in, so the destination page is never showing stale
      // pending counts because this notification was just handled elsewhere.
      onRefreshRequest?.();

      if (notification.target) {
        navigate(notification.target);
      }
    } catch (error) {
      console.error("Failed to mark admin notification as read:", error);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleMarkAllAsRead() {
    if (unreadCount === 0 || isMarkingAllRead) return;

    try {
      setIsMarkingAllRead(true);

      await adminNotificationService.markAllAsRead();

      const now = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at ?? now,
        })),
      );

      applyUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all admin notifications as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  return (
    <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Bell className="h-4 w-4" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>

            <p className="text-[11px] text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} pending request${
                    unreadCount === 1 ? "" : "s"
                  } from your team`
                : "You're all caught up"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close notifications"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {unreadCount > 0 && (
        <div className="flex items-center justify-end border-b border-gray-100 px-4 py-2">
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {isMarkingAllRead ? "Marking..." : "Mark all as read"}
          </button>
        </div>
      )}

      <div className="max-h-[430px] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            <p className="text-sm font-medium text-gray-600">
              Loading notifications...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
              <Bell className="h-6 w-6 text-gray-300" />
            </div>

            <h4 className="text-sm font-semibold text-gray-800">
              No notifications
            </h4>

            <p className="mt-1 max-w-[240px] text-xs leading-5 text-gray-500">
              Requests raised by your team will appear here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const { icon: Icon, className: iconClass } =
              getIconSpec(notification.type);

            const isProcessing = processingId === notification.id;

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                disabled={isProcessing}
                className={`group flex w-full gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition last:border-b-0 ${
                  notification.is_read
                    ? "bg-white hover:bg-gray-50"
                    : "bg-blue-50/40 hover:bg-blue-50/70"
                } disabled:cursor-wait`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`line-clamp-1 text-sm ${
                        notification.is_read
                          ? "font-medium text-gray-700"
                          : "font-semibold text-gray-900"
                      }`}
                    >
                      {notification.title}
                    </h4>

                    {!notification.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                    {notification.message}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                    <Clock className="h-3 w-3" />
                    {formatNotificationTime(notification.created_at)}

                    {isProcessing && (
                      <>
                        <span>&bull;</span>
                        <span className="text-blue-500">Opening...</span>
                      </>
                    )}
                  </div>
                </div>

                {notification.is_read && (
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition group-hover:opacity-100">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {!isLoading && notifications.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-2.5">
          <p className="text-center text-[10px] font-medium text-gray-400">
            Showing your latest {notifications.length} notification
            {notifications.length === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminNotificationDropdown;