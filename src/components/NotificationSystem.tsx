import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Clock, FileText, User, Calendar } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface NotificationData {
  letter_number?: string;
  [key: string]: any;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'late_warning' | 'absence_warning' | 'salary_info' | 'system_alert' | 'general';
  is_read: boolean;
  created_at: string;
  data?: NotificationData;
}

interface NotificationSystemProps {
  userId: string | null;
  userRole: string;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ userId, userRole }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Gagal memuat notifikasi. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchNotifications();

      const subscription = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userId, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setError('Gagal menandai notifikasi sebagai dibaca.');
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setError('Gagal menandai semua notifikasi sebagai dibaca.');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const iconClass = "h-5 w-5";
    switch (type) {
      case 'late_warning':
        return <Clock className={`${iconClass} text-orange-500`} />;
      case 'absence_warning':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'salary_info':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'system_alert':
        return <FileText className={`${iconClass} text-blue-500`} />;
      case 'general':
        return <User className={`${iconClass} text-gray-500`} />;
      default:
        return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'late_warning':
        return 'border-l-orange-400 bg-orange-50 dark:border-l-orange-600 dark:bg-orange-900/30';
      case 'absence_warning':
        return 'border-l-red-400 bg-red-50 dark:border-l-red-600 dark:bg-red-900/30';
      case 'salary_info':
        return 'border-l-green-400 bg-green-50 dark:border-l-green-600 dark:bg-green-900/30';
      case 'system_alert':
        return 'border-l-blue-400 bg-blue-50 dark:border-l-blue-600 dark:bg-blue-900/30';
      case 'general':
        return 'border-l-gray-400 bg-gray-50 dark:border-l-gray-600 dark:bg-gray-900/30';
      default:
        return 'border-l-gray-400 bg-gray-50 dark:border-l-gray-600 dark:bg-gray-900/30';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Baru saja' : `${diffInMinutes} menit yang lalu`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} jam yang lalu`;
    } else {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
      >
        <Bell className="h-6 w-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setShowNotifications(false)}
            aria-hidden="true"
          />
          
          <div
            className="fixed md:absolute right-0 mt-2 w-full md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] md:max-h-96 overflow-hidden md:top-auto bottom-0 md:bottom-auto transform transition-all duration-200"
            role="dialog"
            aria-labelledby="notification-panel-title"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                <h3 id="notification-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifikasi
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Tandai semua notifikasi sebagai dibaca"
                  >
                    Tandai semua dibaca
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Tutup panel notifikasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            <div className="max-h-[calc(80vh-120px)] md:max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Memuat notifikasi...</p>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      !notification.is_read ? getNotificationColor(notification.type) : 'border-l-gray-200 dark:border-l-gray-700 bg-white dark:bg-gray-800'
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && !notification.is_read && markAsRead(notification.id)}
                    aria-label={`Notifikasi: ${notification.title}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p
                            className={`text-sm font-medium ${
                              !notification.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatTime(notification.created_at)}
                          </p>
                          {notification.data?.letter_number && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                              {notification.data.letter_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Tidak ada notifikasi</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Notifikasi akan muncul di sini</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
                <button
                  className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Lihat semua notifikasi"
                >
                  Lihat semua notifikasi
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationSystem;