import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useUserRewards } from '@/hooks/useRewards';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Linkedin, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  Copy, 
  Check,
  Trophy,
  Target,
  Flame,
  Zap
} from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ open, onOpenChange }: ShareModalProps) {
  const { data: profile } = useProfile();
  const { data: rewards } = useUserRewards();
  const [copied, setCopied] = useState(false);

  const accuracy = profile && profile.total_questions > 0 
    ? Math.round((profile.total_correct / profile.total_questions) * 100) 
    : 0;

  const shareText = `🎯 Estou evoluindo nos estudos com o StudyQuiz!\n\n📊 Meus resultados:\n✅ ${profile?.total_quizzes || 0} simulados completos\n🎯 ${accuracy}% de precisão\n🔥 ${profile?.streak_days || 0} dias de sequência\n⭐ ${rewards?.total_points || 0} pontos\n\nVenha estudar comigo! 📚`;

  const shareUrl = window.location.origin;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      toast.success('Copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const shareToLinkedin = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToWhatsapp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
    window.open(url, '_blank');
  };

  const shareToInstagram = () => {
    // Instagram doesn't have a direct share API, so we copy and guide user
    handleCopyLink();
    toast.info('Texto copiado! Cole no Instagram Stories ou Direct.');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            Compartilhar Evolução
          </DialogTitle>
          <DialogDescription>
            Mostre sua evolução para amigos e nas redes sociais
          </DialogDescription>
        </DialogHeader>

        {/* Stats Preview Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/20">
          <CardContent className="p-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground mb-1">Minha evolução no StudyQuiz</p>
              <p className="font-display font-bold text-lg">{profile?.display_name || 'Estudante'}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-xl bg-background/50">
                <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{profile?.total_quizzes || 0}</p>
                <p className="text-[10px] text-muted-foreground">Simulados</p>
              </div>
              <div className="p-2 rounded-xl bg-background/50">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-accent" />
                <p className="text-lg font-bold">{accuracy}%</p>
                <p className="text-[10px] text-muted-foreground">Precisão</p>
              </div>
              <div className="p-2 rounded-xl bg-background/50">
                <Flame className="w-5 h-5 mx-auto mb-1 text-destructive" />
                <p className="text-lg font-bold">{profile?.streak_days || 0}</p>
                <p className="text-[10px] text-muted-foreground">Sequência</p>
              </div>
              <div className="p-2 rounded-xl bg-background/50">
                <Zap className="w-5 h-5 mx-auto mb-1 text-success" />
                <p className="text-lg font-bold">{rewards?.total_points || 0}</p>
                <p className="text-[10px] text-muted-foreground">Pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Buttons */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Compartilhar em:</p>
          <div className="grid grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#0077B5]/10 hover:border-[#0077B5]/50 hover:text-[#0077B5]"
              onClick={shareToLinkedin}
            >
              <Linkedin className="w-6 h-6" />
              <span className="text-xs">LinkedIn</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#E4405F]/10 hover:border-[#E4405F]/50 hover:text-[#E4405F]"
              onClick={shareToInstagram}
            >
              <Instagram className="w-6 h-6" />
              <span className="text-xs">Instagram</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#1877F2]/10 hover:border-[#1877F2]/50 hover:text-[#1877F2]"
              onClick={shareToFacebook}
            >
              <Facebook className="w-6 h-6" />
              <span className="text-xs">Facebook</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#25D366]/10 hover:border-[#25D366]/50 hover:text-[#25D366]"
              onClick={shareToWhatsapp}
            >
              <MessageCircle className="w-6 h-6" />
              <span className="text-xs">WhatsApp</span>
            </Button>
          </div>
        </div>

        {/* Copy Link */}
        <Button
          variant="secondary"
          className="w-full gap-2"
          onClick={handleCopyLink}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar Texto'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
