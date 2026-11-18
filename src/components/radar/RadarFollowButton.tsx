import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRadarFollows, useToggleRadarFollow } from '@/hooks/useRadar';
import { cn } from '@/lib/utils';

interface Props {
  concursoId: string;
  /** Nome curto para o aviso ("Você vai receber..."). */
  label?: string;
  size?: 'sm' | 'default';
  className?: string;
}

/** Botão "Acompanhar" de um concurso: liga os avisos de edital, datas e retificações. */
export function RadarFollowButton({ concursoId, label, size = 'sm', className }: Props) {
  const { data: follows } = useRadarFollows();
  const toggle = useToggleRadarFollow();
  const { toast } = useToast();
  const following = !!follows?.some((f) => f.concurso_id === concursoId);

  const onClick = (e: React.MouseEvent) => {
    // O botão costuma ficar dentro de um cartão-link.
    e.preventDefault();
    e.stopPropagation();
    toggle.mutate(
      { concursoId, follow: !following },
      {
        onSuccess: () =>
          toast({
            title: following ? 'Você deixou de acompanhar' : 'Pronto, você está acompanhando',
            description: following
              ? undefined
              : `Avisaremos quando ${label ?? 'este concurso'} tiver novidade no edital, nas datas ou nas inscrições.`,
          }),
        onError: (err) =>
          toast({ title: 'Não foi possível salvar', description: err instanceof Error ? err.message : undefined, variant: 'destructive' }),
      },
    );
  };

  return (
    <Button
      type="button"
      size={size}
      variant={following ? 'secondary' : 'outline'}
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={following}
      className={cn('gap-1.5 shrink-0', className)}
    >
      {following ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      {following ? 'Acompanhando' : 'Acompanhar'}
    </Button>
  );
}
