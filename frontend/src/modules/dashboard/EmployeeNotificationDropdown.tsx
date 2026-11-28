import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Info,
  Megaphone,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { employeeNotificationService } from "./employeeNotificationService";
import type { EmployeeNotification } from "./notificationTypes";

interface EmployeeNotificationDropdownProps {
  onUnreadCountChange?: (count: number) => void;
  onClose?: () => void;
}

function getNotificationIcon(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("announcement")) {
    return <Megaphone className="h-4 w-4" />;
  }

  if (normalizedType.includes("leave")) {
    return <Clock className="h-4 w-4" />;
  }

  if (
    normalizedType.includes("document") ||
    normalizedType.includes("payroll")
  ) {
    return <FileText className="h-4 w-4" />;
  }

  return <Info className="h-4 w-4" />;
}

function getNotificationIconStyle(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("announcement")) {
    return "bg-blue-50 text-blue-600";
  }

  if (normalizedType.includes("leave")) {
    return "bg-purple-50 text-purple-600";
  }

  if (
    normalizedType.includes("document") ||
    normalizedType.includes("payroll")
  ) {
    return "bg-emerald-50 text-emerald-600";
  }

  return "bg-gray-100 text-gray-600";
}

function formatNotificationTime(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const difference = now.getTime() - date.getTime();

  const seconds = Math.floor(difference / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getNotificationTarget(notification: EmployeeNotification) {
  const type = notification.type.toLowerCase();

  if (type.includes("support_ticket")) {
    return "/employee/help";
  }

  if (type.includes("leave")) {
    return "/employee/leave";
  }

  if (type.includes("regularization")) {
    return "/employee/attendance";
  }

  if (type.includes("announcement")) {
    return "/employee/announcements";
  }

  if (type.includes("document")) {
    return "/employee/documents";
  }

  if (type.includes("payroll") || type.includes("payslip")) {
    return "/employee/payroll";
  }

  return notification.target || null;
}

function EmployeeNotificationDropdown({
  onUnreadCountChange,
  onClose,
}: EmployeeNotificationDropdownProps) {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<EmployeeNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [processingNotificationId, setProcessingNotificationId] = useState<
    string | null
  >(null);

  const updateUnreadCount = (count: number) => {
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  };

  useEffect(() => {
    let active = true;
    void employeeNotificationService
      .getNotifications({ page: 1, limit: 20 })
      .then((response) => {
        if (!active) return;
        setNotifications(response.notifications);
        onUnreadCountChange?.(response.unread_count);
      })
      .catch((error) => {
        console.error("Failed to fetch employee notifications:", error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onUnreadCountChange]);

  const handleNotificationClick = async (
    notification: EmployeeNotification,
  ) => {
    try {
      if (!notification.is_read) {
        setProcessingNotificationId(notification.id);

        await employeeNotificationService.markAsRead(notification.id);

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

        setUnreadCount((previous) => {
          const updated = Math.max(0, previous - 1);
          onUnreadCountChange?.(updated);
          return updated;
        });
      }
      console.log("Clicked notification:", {
        type: notification.type,
        target: notification.target,
        title: notification.title,
      });

      const target = getNotificationTarget(notification);

      console.log("Resolved notification target:", target);

      if (target) {
        onClose?.();
        navigate(target);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    } finally {
      setProcessingNotificationId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAllRead) {
      return;
    }

    try {
      setIsMarkingAllRead(true);

      await employeeNotificationService.markAllAsRead();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      );

      updateUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[2px] border border-gray-200 bg-white shadow-2xl">
      {/* Header */}
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
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"
                }`
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

      {/* Actions */}
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

      {/* Notification list */}
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
              You don't have any notifications right now.
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isProcessing =
              processingNotificationId === notification.id;

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                disabled={isProcessing}
                className={`group flex w-full gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition last:border-b-0 ${notification.is_read
                  ? "bg-white hover:bg-gray-50"
                  : "bg-blue-50/40 hover:bg-blue-50/70"
                  } disabled:cursor-wait`}
              >
                {/* Icon */}
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getNotificationIconStyle(
                    notification.type,
                  )}`}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`line-clamp-1 text-sm ${notification.is_read
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
                        <span>•</span>
                        <span className="text-blue-500">Opening...</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Read indicator */}
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

      {/* Footer */}
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

export default EmployeeNotificationDropdown;