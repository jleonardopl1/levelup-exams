import { useState } from 'react';
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
import { Achievement } from '@/hooks/useRewards';
import { 
  Linkedin, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  Copy, 
  Check,
  Share2,
  Star,
  X
} from 'lucide-react';

interface AchievementShareModalProps {
  achievement: Achievement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Icon mapping
const iconMap: Record<string, string> = {
  star: '⭐',
  trophy: '🏆',
  medal: '🥇',
  fire: '🔥',
  flame: '🔥',
  zap: '⚡',
  target: '🎯',
  book: '📚',
  crown: '👑',
  rocket: '🚀',
  gem: '💎',
  heart: '❤️',
  lightning: '⚡',
  award: '🏅',
  gift: '🎁',
  sparkles: '✨',
  secret: '🔮',
};

// Tier colors and labels
const tierConfig: Record<string, { label: string; gradient: string; emoji: string }> = {
  bronze: { label: 'Bronze', gradient: 'from-amber-600 to-amber-800', emoji: '🥉' },
  silver: { label: 'Prata', gradient: 'from-slate-300 to-slate-500', emoji: '🥈' },
  gold: { label: 'Ouro', gradient: 'from-yellow-400 to-amber-600', emoji: '🥇' },
  platinum: { label: 'Platina', gradient: 'from-cyan-300 to-blue-500', emoji: '💠' },
  diamond: { label: 'Diamante', gradient: 'from-purple-400 to-pink-600', emoji: '💎' },
};

export function AchievementShareModal({ achievement, open, onOpenChange }: AchievementShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!achievement) return null;

  const tier = tierConfig[achievement.tier] || tierConfig.bronze;
  const achievementEmoji = iconMap[achievement.icon] || '🏆';
  
  const shareText = `🎉 Acabei de desbloquear uma conquista!\n\n${achievementEmoji} ${achievement.name}\n${tier.emoji} Tier: ${tier.label}\n⭐ +${achievement.points_reward} pontos\n\n"${achievement.description}"\n\nEstude comigo no StudyQuiz! 📚`;

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
    handleCopyLink();
    toast.info('Texto copiado! Cole no Instagram Stories ou Direct.');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Compartilhar Conquista
          </DialogTitle>
          <DialogDescription>
            Mostre sua conquista para amigos e nas redes sociais!
          </DialogDescription>
        </DialogHeader>

        {/* Achievement Preview Card */}
        <Card className={`bg-gradient-to-br ${tier.gradient} border-0 text-white overflow-hidden relative`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-2 right-2 text-4xl opacity-20">{achievementEmoji}</div>
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <span className="text-3xl">{achievementEmoji}</span>
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-sm font-medium">Nova Conquista!</p>
                <h3 className="text-xl font-bold">{achievement.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm">{tier.emoji} {tier.label}</span>
                  <span className="text-white/60">•</span>
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-white" />
                    +{achievement.points_reward}
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-white/90 italic">
              "{achievement.description}"
            </p>
          </CardContent>
        </Card>

        {/* Share Buttons */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Compartilhar em:</p>
          <div className="grid grid-cols-5 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#0077B5]/10 hover:border-[#0077B5]/50 hover:text-[#0077B5]"
              onClick={shareToLinkedin}
            >
              <Linkedin className="w-5 h-5" />
              <span className="text-[10px]">LinkedIn</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#E4405F]/10 hover:border-[#E4405F]/50 hover:text-[#E4405F]"
              onClick={shareToInstagram}
            >
              <Instagram className="w-5 h-5" />
              <span className="text-[10px]">Instagram</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#1877F2]/10 hover:border-[#1877F2]/50 hover:text-[#1877F2]"
              onClick={shareToFacebook}
            >
              <Facebook className="w-5 h-5" />
              <span className="text-[10px]">Facebook</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/50 hover:text-[#1DA1F2]"
              onClick={shareToTwitter}
            >
              <X className="w-5 h-5" />
              <span className="text-[10px]">X</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-[#25D366]/10 hover:border-[#25D366]/50 hover:text-[#25D366]"
              onClick={shareToWhatsapp}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-[10px]">WhatsApp</span>
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
