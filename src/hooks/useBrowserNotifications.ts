import { useEffect, useState } from 'react';

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    }
    return false;
  };

  const sendNotification = (title: string, body: string) => {
    if (permission === 'granted' && 'Notification' in window) {
      new Notification(title, { body });
    }
  };

  return { permission, requestPermission, sendNotification };
}
