import { Square, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  /** Este trecho está sendo lido agora. */
  speaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
  /** Rótulo do que será lido, ex.: "questão" ou "explicação". */
  what: string;
  className?: string;
}

/** Botão "Ouvir/Parar" da leitura em voz alta (só aparece se o navegador fala). */
export function SpeakButton({ speaking, onSpeak, onStop, what, className }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 text-xs text-muted-foreground', className)}
      onClick={speaking ? onStop : onSpeak}
      aria-pressed={speaking}
      aria-label={speaking ? `Parar a leitura da ${what}` : `Ouvir a ${what}`}
    >
      {speaking ? <Square className="w-3.5 h-3.5 mr-1" /> : <Volume2 className="w-3.5 h-3.5 mr-1" />}
      {speaking ? 'Parar' : 'Ouvir'}
    </Button>
  );
}
