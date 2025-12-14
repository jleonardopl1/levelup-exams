import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Camera, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileCompletionModalProps {
  open: boolean;
  onComplete: () => void;
}

const avatarOptions = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
];

export default function ProfileCompletionModal({ open, onComplete }: ProfileCompletionModalProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatarOptions[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Por favor, insira seu nome');
      return;
    }

    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: selectedAvatar,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Perfil criado com sucesso!');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar perfil');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-card via-card to-card/95 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        
        <DialogHeader className="relative z-10 space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow animate-pulse-slow">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl font-display bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            Complete seu perfil
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Personalize sua experiência de estudos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-6 mt-4">
          {/* Avatar Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground/90">
              Escolha seu avatar
            </Label>
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Avatar className="w-24 h-24 ring-4 ring-primary/20 shadow-xl">
                  <AvatarImage src={selectedAvatar} alt="Avatar" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                    {displayName ? getInitials(displayName) : <User className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Camera className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`relative rounded-full p-0.5 transition-all duration-300 ${
                    selectedAvatar === avatar
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                      : 'hover:scale-105 opacity-70 hover:opacity-100'
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                  </Avatar>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium text-foreground/90">
              Como você gostaria de ser chamado?
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="displayName"
                placeholder="Seu nome de exibição"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
                maxLength={50}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este nome será exibido no ranking e conquistas
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            disabled={loading || !displayName.trim()}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Começar a estudar
              </span>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Você pode alterar essas informações depois nas configurações
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
