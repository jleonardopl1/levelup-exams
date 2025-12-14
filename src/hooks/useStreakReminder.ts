import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';

const NOTIFICATION_PERMISSION_KEY = 'streak_notification_permission';
const LAST_REMINDER_KEY = 'last_streak_reminder';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isEnabled: boolean;
}

export function useStreakReminder() {
  const { data: profile } = useProfile();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isEnabled: false,
  });

  // Check if notifications are supported
  useEffect(() => {
    const isSupported = 'Notification' in window;
    const savedEnabled = localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === 'true';
    
    setState({
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
      isEnabled: savedEnabled && (isSupported ? Notification.permission === 'granted' : false),
    });
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      if (granted) {
        localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
      }
      
      setState(prev => ({
        ...prev,
        permission,
        isEnabled: granted,
      }));
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  // Disable notifications
  const disableNotifications = useCallback(() => {
    localStorage.removeItem(NOTIFICATION_PERMISSION_KEY);
    setState(prev => ({ ...prev, isEnabled: false }));
  }, []);

  // Enable notifications
  const enableNotifications = useCallback(async () => {
    if (state.permission === 'granted') {
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
      setState(prev => ({ ...prev, isEnabled: true }));
      return true;
    }
    return requestPermission();
  }, [state.permission, requestPermission]);

  // Show streak reminder notification
  const showStreakReminder = useCallback(() => {
    if (!state.isEnabled || !profile) return;

    const lastReminder = localStorage.getItem(LAST_REMINDER_KEY);
    const today = new Date().toDateString();
    
    // Only show once per day
    if (lastReminder === today) return;

    const streakDays = profile.streak_days || 0;
    let title = '📚 Hora de estudar!';
    let body = 'Não perca seu progresso. Faça um simulado agora!';

    if (streakDays > 0) {
      title = `🔥 Mantenha sua sequência de ${streakDays} dias!`;
      body = 'Você está indo muito bem! Continue estudando para não perder sua sequência.';
    }

    if (streakDays >= 7) {
      title = `🏆 ${streakDays} dias de sequência incrível!`;
      body = 'Sua dedicação é inspiradora! Vamos manter essa chama acesa?';
    }

    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'streak-reminder',
        requireInteraction: false,
      });
      
      localStorage.setItem(LAST_REMINDER_KEY, today);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [state.isEnabled, profile]);

  // Schedule daily reminder check
  useEffect(() => {
    if (!state.isEnabled) return;

    // Check if user hasn't studied today
    const checkAndRemind = () => {
      if (!profile) return;
      
      const lastActivity = profile.last_activity_date;
      const today = new Date().toISOString().split('T')[0];
      
      // If user hasn't studied today and it's after 18:00
      if (lastActivity !== today) {
        const hour = new Date().getHours();
        if (hour >= 18) {
          showStreakReminder();
        }
      }
    };

    // Check on component mount
    checkAndRemind();

    // Check every hour
    const interval = setInterval(checkAndRemind, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [state.isEnabled, profile, showStreakReminder]);

  return {
    ...state,
    requestPermission,
    enableNotifications,
    disableNotifications,
    showStreakReminder,
  };
}

// Hook to show achievement notification
export function useAchievementNotification() {
  const showAchievementNotification = useCallback((name: string, description: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      new Notification(`🏆 Nova Conquista: ${name}!`, {
        body: description,
        icon: '/favicon.ico',
        tag: 'achievement',
        requireInteraction: false,
      });
    } catch (error) {
      console.error('Error showing achievement notification:', error);
    }
  }, []);

  return { showAchievementNotification };
}
