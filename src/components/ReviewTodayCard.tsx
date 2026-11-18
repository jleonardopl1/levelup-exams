import { Link } from 'react-router-dom';
import { Repeat, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useReviewQueue } from '@/hooks/useQuestions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Revisão espaçada: erros voltam em 1, 3, 7, 14 e 30 dias (mais cedo perto da prova).
 * Some quando não há nada vencido hoje.
 */
export function ReviewTodayCard({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data } = useReviewQueue(!!user);
  if (!data || data.due_total === 0) return null;

  const freeLeft = data.limited ? data.free_remaining_today ?? 0 : null;
  const canPractice = freeLeft === null || freeLeft > 0;
  const batch = freeLeft === null ? Math.min(10, data.due_total) : Math.min(freeLeft, data.due_total);

  return (
    <Card variant="elevated" className={className}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Repeat className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            Revisão de hoje: {data.due_total} {data.due_total === 1 ? 'questão' : 'questões'}
          </p>
          <p className="text-xs text-muted-foreground">
            {freeLeft === null
              ? 'Erros que voltam no momento certo para você não esquecer.'
              : canPractice
                ? `No plano gratuito: mais ${freeLeft} hoje. No Plus, a fila inteira.`
                : 'Você fez as 5 revisões gratuitas de hoje. No Plus, a fila inteira.'}
          </p>
        </div>
        {canPractice ? (
          <Button asChild size="sm"><Link to={`/quiz?mode=srs`}>Revisar {batch}</Link></Button>
        ) : (
          <Button asChild size="sm" variant="outline"><Link to="/upgrade"><Crown className="w-4 h-4 mr-1 text-amber-500" /> Plus</Link></Button>
        )}
      </CardContent>
    </Card>
  );
}
