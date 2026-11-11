import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Copy, Download, MoreVertical, PlusSquare, Share, Smartphone, Monitor, Zap, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { detectPlatform, isInAppBrowser, isIosNonSafari, useInstallPrompt, type Platform } from '@/lib/pwa';

const APP_URL = 'https://levelupexams.lovable.app';

const TABS: { id: Platform; label: string; icon: typeof Smartphone }[] = [
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
  { id: 'desktop', label: 'Computador', icon: Monitor },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {n}
      </span>
      <div className="pt-0.5 text-sm leading-relaxed">{children}</div>
    </li>
  );
}

export default function InstallApp() {
  const navigate = useNavigate();
  const detected = useMemo(() => detectPlatform(), []);
  const [tab, setTab] = useState<Platform>(detected);
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const inAppBrowser = useMemo(() => isInAppBrowser(), []);
  const iosWrongBrowser = useMemo(() => isIosNonSafari(), []);

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast.success('Pronto! O LevelUp Exams foi adicionado à sua tela inicial.');
    else if (outcome === 'unavailable') toast.info('Use o menu do navegador, conforme os passos abaixo.');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      toast.success('Link copiado! Cole no Safari (iPhone) ou no Chrome (Android).');
    } catch {
      toast.info(APP_URL);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-hero px-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="glass" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-display font-bold text-primary-foreground">Baixar o app</h1>
        </div>
        <div className="text-center">
          <img src="/icon-192.png" alt="" className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg" />
          <h2 className="text-2xl font-display font-bold text-primary-foreground mb-1">LevelUp Exams no seu celular</h2>
          <p className="text-primary-foreground/80 text-sm max-w-md mx-auto">
            Instale em segundos, direto do navegador. Grátis, sem ocupar espaço e sempre atualizado.
          </p>
        </div>
      </div>

      <div className="px-4 -mt-6 pb-10 max-w-xl mx-auto space-y-4">
        {installed ? (
          <Card variant="elevated">
            <CardContent className="p-5 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
              <div>
                <p className="font-semibold">App instalado</p>
                <p className="text-sm text-muted-foreground">Abra o LevelUp Exams pelo ícone na tela inicial do seu aparelho.</p>
              </div>
            </CardContent>
          </Card>
        ) : canPrompt && (
          <Card variant="elevated">
            <CardContent className="p-5 space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Seu navegador permite instalar com um toque:</p>
              <Button variant="hero" size="lg" className="w-full" onClick={handleInstall}>
                <Download className="w-5 h-5 mr-2" /> Instalar o app
              </Button>
            </CardContent>
          </Card>
        )}

        {inAppBrowser && !installed && (
          <Card className="border-amber-500/50">
            <CardContent className="p-4 text-sm space-y-3">
              <p>
                Você abriu o link dentro de outro aplicativo (Instagram, WhatsApp...). Para instalar, abra no navegador:
                {detected === 'ios' ? ' Safari' : ' Chrome'}.
              </p>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="w-4 h-4 mr-2" /> Copiar link do app
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Escolha seu aparelho">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors',
                tab === t.id ? 'border-primary bg-card text-primary ring-1 ring-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <t.icon className="w-5 h-5" />
              {t.label}
              {t.id === detected && <span className="text-[10px] opacity-70">(seu aparelho)</span>}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tab === 'android' && 'Instalar no Android (Chrome)'}
              {tab === 'ios' && 'Instalar no iPhone ou iPad (Safari)'}
              {tab === 'desktop' && 'Instalar no computador (Chrome ou Edge)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tab === 'android' && (
              <ol className="space-y-4">
                <Step n={1}>Abra <strong>{APP_URL.replace('https://', '')}</strong> no <strong>Google Chrome</strong>.</Step>
                <Step n={2}>
                  Toque em <strong>“Instalar o app”</strong> acima. Se o botão não aparecer, toque no menu
                  <MoreVertical className="inline w-4 h-4 mx-1 align-text-bottom" aria-label="três pontinhos" />
                  e escolha <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
                </Step>
                <Step n={3}>Confirme em <strong>“Instalar”</strong>. O ícone do LevelUp aparece junto com seus outros apps.</Step>
              </ol>
            )}
            {tab === 'ios' && (
              <div className="space-y-4">
                {iosWrongBrowser && (
                  <p className="rounded-md bg-amber-500/10 border border-amber-500/40 p-3 text-sm">
                    No iPhone a instalação funciona pelo <strong>Safari</strong>. Copie o link e abra no Safari.
                    <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={copyLink}>Copiar link</Button>
                  </p>
                )}
                <ol className="space-y-4">
                  <Step n={1}>Abra <strong>{APP_URL.replace('https://', '')}</strong> no <strong>Safari</strong>.</Step>
                  <Step n={2}>
                    Toque no botão <strong>Compartilhar</strong>
                    <Share className="inline w-4 h-4 mx-1 align-text-bottom" aria-label="Compartilhar" />
                    (na barra de baixo ou de cima).
                  </Step>
                  <Step n={3}>
                    Role e toque em <strong>“Adicionar à Tela de Início”</strong>
                    <PlusSquare className="inline w-4 h-4 mx-1 align-text-bottom" aria-hidden />.
                  </Step>
                  <Step n={4}>Toque em <strong>“Adicionar”</strong>. Pronto: abra o LevelUp pelo ícone, em tela cheia.</Step>
                </ol>
              </div>
            )}
            {tab === 'desktop' && (
              <ol className="space-y-4">
                <Step n={1}>Abra <strong>{APP_URL.replace('https://', '')}</strong> no Chrome ou Edge.</Step>
                <Step n={2}>
                  Clique em <strong>“Instalar o app”</strong> acima ou no ícone de instalação
                  <Download className="inline w-4 h-4 mx-1 align-text-bottom" aria-hidden />
                  na barra de endereço.
                </Step>
                <Step n={3}>O LevelUp abre em uma janela própria e ganha atalho na área de trabalho.</Step>
              </ol>
            )}
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="p-4 grid gap-3 text-sm">
            <p className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Abre direto da tela inicial, em tela cheia.</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Mesma conta, progresso e plano do site.</p>
            <p className="flex items-center gap-2"><WifiOff className="w-4 h-4 text-primary" /> Abre mesmo com internet instável (as questões precisam de conexão).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
