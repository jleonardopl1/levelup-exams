import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Crown, History, Loader2, PenLine, RefreshCw, Send, Sparkles } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudyTrack } from '@/hooks/useStudyTracks';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import {
  estimateLines, useEssayQuota, useEssayTheme, useMyEssays, useSubmitEssay, type EssayFeedback,
} from '@/hooks/useEssays';
import { useTrackSelection } from '@/lib/trackPrefs';
import { LIMITS } from '@/config/plans';
import { cn } from '@/lib/utils';

const DRAFT_KEY = (slug: string) => `levelup:discursiva:${slug}`;

function loadDraft(slug: string): { tema: string; texto: string } {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(slug));
    const parsed = raw ? JSON.parse(raw) : null;
    return { tema: String(parsed?.tema ?? ''), texto: String(parsed?.texto ?? '') };
  } catch {
    return { tema: '', texto: '' };
  }
}

export default function Discursiva() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useStudyTrack(slug);
  const modules = data?.modules ?? [];
  const { module, cargo, setModule, setCargo } = useTrackSelection(slug, modules);
  const { isPremium } = useQuestionLimits();
  const { data: quota } = useEssayQuota();
  const { data: history } = useMyEssays();
  const theme = useEssayTheme();
  const submit = useSubmitEssay();

  const [tema, setTema] = useState(() => loadDraft(slug ?? '').tema);
  const [orientacoes, setOrientacoes] = useState<string[]>([]);
  const [texto, setTexto] = useState(() => loadDraft(slug ?? '').texto);
  const [result, setResult] = useState<{ score: number; feedback: EssayFeedback; tema: string } | null>(null);

  // Rascunho local: não perde o texto se fechar a aba.
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY(slug ?? ''), JSON.stringify({ tema, texto })); } catch { /* ignore */ }
  }, [slug, tema, texto]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!data || !module) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <p className="p-6 text-center text-muted-foreground">Trilha não encontrada.</p>
      </div>
    );
  }

  const lines = estimateLines(texto);
  const lineState = lines === 0 ? 'empty' : lines < 20 ? 'short' : lines > 30 ? 'long' : 'ok';
  const noQuota = !!quota && quota.remaining <= 0;
  const canSubmit = isPremium && !!cargo && tema.trim().length >= 10 && texto.trim().length >= 200 && !noQuota && !submit.isPending;

  const generateTheme = () => {
    if (!cargo) return;
    theme.mutate({ moduleId: module.id, cargo }, {
      onSuccess: (r) => { setTema(r.tema); setOrientacoes(r.orientacoes); },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const send = () => {
    if (!cargo) return;
    submit.mutate({ moduleId: module.id, cargo, tema: tema.trim(), texto }, {
      onSuccess: (r) => {
        setResult({ score: r.score, feedback: r.feedback, tema: tema.trim() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />
      <div className="px-4 pt-4 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trilhas/${slug}`)} aria-label="Voltar à trilha">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{data.track.short_name}</p>
            <h1 className="font-display font-bold text-xl leading-tight">Discursiva</h1>
          </div>
        </div>

        {data.track.rules.discursiva && (
          <p className="text-sm text-muted-foreground">{data.track.rules.discursiva}</p>
        )}

        {result && (
          <EssayResult score={result.score} feedback={result.feedback} tema={result.tema} onNew={() => { setResult(null); setTexto(''); }} />
        )}

        {!isPremium ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold flex items-center gap-2"><PenLine className="w-5 h-5 text-primary" /> Correção com os critérios da banca</p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Tema do seu cargo, a partir do conteúdo específico do edital</li>
                <li>Nota estimada: 80 de conteúdo (3 critérios) + 20 de correção formal</li>
                <li>Cada erro de português com o trecho e a correção</li>
                <li>O que faltou abordar e seu parágrafo mais fraco reescrito</li>
              </ul>
              <Button asChild className="w-full"><Link to="/upgrade"><Crown className="w-4 h-4 mr-2" /> Disponível no Plus ({LIMITS.essayReviewsPerWeek} por semana)</Link></Button>
            </CardContent>
          </Card>
        ) : !result && (
          <>
            <Tabs value={module.slug} onValueChange={setModule}>
              <TabsList className="grid w-full grid-cols-2">
                {modules.map((m) => <TabsTrigger key={m.slug} value={m.slug}>{m.name}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="cargo-discursiva">Seu cargo</label>
              <Select value={cargo ?? undefined} onValueChange={setCargo}>
                <SelectTrigger id="cargo-discursiva"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>{module.cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {quota && (
              <p className={cn('text-xs', noQuota ? 'text-destructive' : 'text-muted-foreground')}>
                {noQuota
                  ? `Você usou as ${quota.limit} correções desta semana.${quota.next_slot_at ? ` A próxima libera em ${new Date(quota.next_slot_at).toLocaleDateString('pt-BR')}.` : ''}`
                  : `Correções nesta semana: ${quota.used} de ${quota.limit}. Gerar tema não conta.`}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium" htmlFor="tema">Tema</label>
                <Button size="sm" variant="outline" onClick={generateTheme} disabled={!cargo || theme.isPending}>
                  {theme.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : tema ? <RefreshCw className="w-4 h-4 mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                  {tema ? 'Outro tema' : 'Gerar tema do cargo'}
                </Button>
              </div>
              <Textarea id="tema" rows={3} value={tema} maxLength={1500} onChange={(e) => setTema(e.target.value)}
                placeholder="Gere um tema do seu cargo ou cole o de uma prova anterior." />
              {orientacoes.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                  {orientacoes.map((o) => <li key={o}>{o}</li>)}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium" htmlFor="texto">Sua resposta</label>
                <span className={cn('text-xs tabular-nums', lineState === 'ok' ? 'text-success' : lineState === 'empty' ? 'text-muted-foreground' : 'text-amber-600')}>
                  ~{lines} linhas {lineState === 'short' ? '(mínimo 20)' : lineState === 'long' ? '(máximo 30)' : ''}
                </span>
              </div>
              <Textarea id="texto" rows={16} value={texto} maxLength={6000} onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva como na folha de resposta. Separe os parágrafos com uma linha." className="font-serif leading-relaxed" />
              <p className="text-[11px] text-muted-foreground">
                As linhas são estimadas em cerca de 75 caracteres por linha manuscrita, com cada parágrafo começando numa linha nova.
              </p>
            </div>

            <Button variant="hero" size="xl" className="w-full" onClick={send} disabled={!canSubmit}>
              {submit.isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Corrigindo… (até 1 minuto)</> : <><Send className="w-5 h-5 mr-2" /> Enviar para correção</>}
            </Button>
          </>
        )}

        {history && history.length > 0 && (
          <section className="space-y-2" aria-labelledby="hist">
            <h2 id="hist" className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Correções anteriores</h2>
            {history.map((h) => (
              <button key={h.id} className="w-full text-left" onClick={() => h.feedback && h.score !== null && setResult({ score: Number(h.score), feedback: h.feedback, tema: h.tema })}>
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-12">
                      {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">{h.tema}</span>
                    <span className="font-bold tabular-nums">{Number(h.score ?? 0).toLocaleString('pt-BR')}</span>
                  </CardContent>
                </Card>
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function EssayResult({ score, feedback, tema, onNew }: { score: number; feedback: EssayFeedback; tema: string; onNew: () => void }) {
  return (
    <div className="space-y-4">
      <Card variant="primary">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-end gap-3">
            <p className="text-5xl font-display font-bold tabular-nums leading-none">{score.toLocaleString('pt-BR')}</p>
            <p className="text-sm text-primary-foreground/85 pb-1">de 100 · estimativa</p>
          </div>
          <p className="text-xs text-primary-foreground/85">
            Conteúdo {feedback.conteudo.nota.toLocaleString('pt-BR')}/{feedback.conteudo.max} · Formal {feedback.formal.nota.toLocaleString('pt-BR')}/{feedback.formal.max}
          </p>
          <p className="text-xs text-primary-foreground/75 line-clamp-2">Tema: {tema}</p>
        </CardContent>
      </Card>

      {feedback.linhas?.aviso && (
        <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="p-3 text-sm">{feedback.linhas.aviso}</CardContent></Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Conteúdo</p>
          {feedback.conteudo.criterios.map((c) => (
            <div key={c.key} className="space-y-1">
              <div className="flex justify-between text-xs gap-2">
                <span className="font-medium">{c.nome}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">{c.nota.toLocaleString('pt-BR')}/{c.max}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full', c.nota / c.max >= 0.7 ? 'bg-success' : c.nota / c.max >= 0.4 ? 'bg-accent' : 'bg-destructive')} style={{ width: `${(c.nota / c.max) * 100}%` }} />
              </div>
              {c.comentario && <p className="text-xs text-muted-foreground">{c.comentario}</p>}
            </div>
          ))}
          {feedback.aspectos_ausentes.length > 0 && (
            <div>
              <p className="text-xs font-semibold mt-2">O que faltou abordar</p>
              <ul className="text-xs text-muted-foreground list-disc pl-5">{feedback.aspectos_ausentes.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">
            Correção formal: {feedback.formal.erros.length} {feedback.formal.erros.length === 1 ? 'erro' : 'erros'}
            <span className="font-normal text-muted-foreground"> (−{feedback.formal.desconto_por_erro} ponto cada)</span>
          </p>
          {feedback.formal.erros.length === 0 && <p className="text-xs text-muted-foreground">Nenhum desvio da norma encontrado.</p>}
          <ul className="space-y-1.5">
            {feedback.formal.erros.map((e, i) => (
              <li key={i} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <Badge variant="outline" className="text-[10px] h-5">{e.tipo}</Badge>
                <span className="line-through text-destructive">{e.trecho}</span>
                <span>→ {e.correcao}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(feedback.pontos_fortes.length > 0 || feedback.melhorias.length > 0) && (
        <Card>
          <CardContent className="p-4 grid sm:grid-cols-2 gap-4">
            {feedback.pontos_fortes.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-success">Pontos fortes</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">{feedback.pontos_fortes.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
            {feedback.melhorias.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-primary">Para a próxima</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">{feedback.melhorias.map((p) => <li key={p}>{p}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {feedback.reescrita?.sugerida && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold">Seu parágrafo mais fraco, reescrito</p>
            <p className="text-sm text-muted-foreground border-l-2 border-destructive/40 pl-3">{feedback.reescrita.original}</p>
            <p className="text-sm border-l-2 border-success/60 pl-3">{feedback.reescrita.sugerida}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Nota estimada por IA com a estrutura do edital (80 de conteúdo + 20 formal). A banca pode corrigir diferente; use como treino.
      </p>
      <Button variant="outline" className="w-full" onClick={onNew}><PenLine className="w-4 h-4 mr-2" /> Escrever outra</Button>
    </div>
  );
}
