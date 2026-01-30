import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Check, Sparkles, Zap, BookOpen, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PremiumUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerContext?: 'question' | 'limit' | 'feature';
}

export function PremiumUpsellModal({ 
  open, 
  onOpenChange,
  triggerContext = 'question'
}: PremiumUpsellModalProps) {
  const navigate = useNavigate();

  const contextMessages = {
    question: {
      title: 'Questão Exclusiva Plus',
      subtitle: 'Esta questão faz parte do nosso conteúdo premium exclusivo para assinantes Plus'
    },
    limit: {
      title: 'Limite Diário Atingido',
      subtitle: 'Você atingiu o limite de questões gratuitas de hoje'
    },
    feature: {
      title: 'Recurso Premium',
      subtitle: 'Este recurso está disponível apenas para assinantes Plus'
    }
  };

  const message = contextMessages[triggerContext];

  const features = [
    { icon: BookOpen, text: 'Questões ilimitadas por dia', highlight: true },
    { icon: Sparkles, text: 'Acesso a questões exclusivas premium' },
    { icon: MessageSquare, text: 'Mentor IA ilimitado' },
    { icon: Zap, text: 'Estatísticas avançadas' },
    { icon: Crown, text: 'Sem anúncios' },
  ];

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/upgrade');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader className="text-center space-y-3">
          {/* Premium Crown Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Crown className="w-8 h-8 text-white" />
          </div>
          
          <DialogTitle className="text-xl font-display">
            {message.title}
          </DialogTitle>
          
          <p className="text-sm text-muted-foreground">
            {message.subtitle}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Features List */}
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  feature.highlight 
                    ? 'bg-gradient-to-r from-amber-500/10 to-yellow-400/10 border border-amber-500/20' 
                    : 'bg-muted/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  feature.highlight 
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  <feature.icon className="w-4 h-4" />
                </div>
                <span className={`text-sm font-medium ${feature.highlight ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                  {feature.text}
                </span>
                {feature.highlight && (
                  <Check className="w-4 h-4 text-success ml-auto" />
                )}
              </div>
            ))}
          </div>

          {/* Price Badge */}
          <div className="text-center p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
            <p className="text-xs text-muted-foreground mb-1">A partir de</p>
            <p className="text-2xl font-bold text-primary">
              R$ 19,90<span className="text-sm font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-xs text-success mt-1">Cancele quando quiser</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            variant="hero" 
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            onClick={handleUpgrade}
          >
            <Crown className="w-4 h-4 mr-2" />
            Assinar Plus
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full" 
            onClick={() => onOpenChange(false)}
          >
            Continuar Gratuito
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
