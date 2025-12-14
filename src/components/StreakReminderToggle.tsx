import { useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useStreakReminder } from '@/hooks/useStreakReminder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function StreakReminderToggle() {
  const { 
    isSupported, 
    isEnabled, 
    permission,
    enableNotifications, 
    disableNotifications 
  } = useStreakReminder();
  const [loading, setLoading] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    setLoading(true);
    
    try {
      if (isEnabled) {
        disableNotifications();
        toast.success('Lembretes desativados');
      } else {
        const granted = await enableNotifications();
        if (granted) {
          toast.success('Lembretes ativados! Você receberá notificações para manter sua sequência.');
        } else if (permission === 'denied') {
          toast.error('Notificações bloqueadas. Ative nas configurações do navegador.');
        }
      }
    } catch (error) {
      toast.error('Erro ao alterar configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isEnabled ? 'default' : 'outline'}
            size="icon"
            onClick={handleToggle}
            disabled={loading || permission === 'denied'}
            className={`h-9 w-9 transition-all ${
              isEnabled 
                ? 'bg-primary/90 hover:bg-primary text-primary-foreground shadow-md' 
                : 'border-border/50 hover:bg-muted/50'
            } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isEnabled ? (
              <BellRing className="w-4 h-4" />
            ) : permission === 'denied' ? (
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {permission === 'denied' ? (
            <p>Notificações bloqueadas no navegador</p>
          ) : isEnabled ? (
            <p>Lembretes de sequência ativados</p>
          ) : (
            <p>Ativar lembretes de sequência</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact inline version for the hero section
export function StreakReminderBanner() {
  const { 
    isSupported, 
    isEnabled, 
    permission,
    enableNotifications 
  } = useStreakReminder();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('streak_banner_dismissed') === 'true';
  });

  if (!isSupported || isEnabled || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    const granted = await enableNotifications();
    if (granted) {
      toast.success('Lembretes ativados!');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('streak_banner_dismissed', 'true');
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20">
      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Ative lembretes</p>
        <p className="text-xs text-muted-foreground">Nunca perca sua sequência de estudos</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground px-2"
        >
          Depois
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleEnable}
          className="bg-primary hover:bg-primary/90"
        >
          Ativar
        </Button>
      </div>
    </div>
  );
}
