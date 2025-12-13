import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Clock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DailyLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DailyLimitModal({ open, onOpenChange }: DailyLimitModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/upgrade');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <DialogTitle className="text-xl">Limite Diário Atingido</DialogTitle>
          <DialogDescription className="text-base">
            Você usou todas as suas 30 questões gratuitas de hoje. Volte amanhã ou faça upgrade para continuar estudando!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="font-bold">Benefícios do Plus</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Questões ilimitadas todos os dias
              </li>
              <li className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Explicações detalhadas em PDF
              </li>
              <li className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Estatísticas avançadas de desempenho
              </li>
              <li className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Questões exclusivas premium
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button variant="hero" size="lg" onClick={handleUpgrade} className="w-full">
              <Crown className="w-4 h-4 mr-2" />
              Fazer Upgrade
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
              Voltar Amanhã
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
