import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Bot, CheckCircle2, ClipboardCheck, Clock,
  Crown, FileDown, Flag, Grid3x3, Loader2, Lock, MinusCircle, Play, Trophy, Users, XCircle,
} from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PrintableReview } from '@/components/PrintableReview';
import { ReportQuestionDialog } from '@/components/ReportQuestionDialog';
import { useStudyTrack, type TrackModule } from '@/hooks/useStudyTracks';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import {
  saveMockAnswer, useFinishMockExam, useMockExamMeta, useMockExamQuestions, useMockExamResult,
  useMockStanding, useMyMockExams, useStartMockExam, type MockExamQuestion,
} from '@/hooks/useMockExam';
import { useTrackSelection } from '@/lib/trackPrefs';
import { LIMITS } from '@/config/plans';
import { cn } from '@/lib/utils';

const DEFAULT_MINUTES = 240;
const DEFAULT_PASS_MARK = 40;
const letter = (i: number | null | undefined) => (i === null || i === undefined || i < 0 ? '—' : String.fromCharCode(65 + i));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
};

function subjectNames(module: TrackModule | undefined) {
  return new Map((module?.subjects ?? []).map((s) => [s.subject_id, s.subject.name]));
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando">
      <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ============================================================================
// Entrada: escolhe entre apresentação, prova em andamento e resultado.
// ============================================================================
export default function SimuladoOficial() {
  const { slug, examId } = useParams();
  const [searchParams] = useSearchParams();
  const running = searchParams.get('exam');
  const { data, isLoading } = useStudyTrack(slug);

  if (isLoading) return <FullPageSpinner />;
  if (!data || data.modules.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="p-6 text-center space-y-3">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Button variant="outline" asChild><Link to="/trilhas">Ver trilhas</Link></Button>
        </div>
      </div>
    );
  }
  if (examId) return <MockResult slug={slug!} examId={examId} modules={data.modules} passMark={data.track.rules.nota_minima ?? DEFAULT_PASS_MARK} />;
  if (running) return <MockRunner slug={slug!} examId={running} modules={data.modules} />;
  return <MockIntro slug={slug!} data={data} />;
}

// ============================================================================
// Apresentação: formato da prova, cota do Free, histórico e início.
// ============================================================================
function MockIntro({ slug, data }: { slug: string; data: NonNullable<ReturnType<typeof useStudyTrack>['data']> }) {
  const navigate = useNavigate();
  const { track, modules } = data;
  const { module, cargo, setModule, setCargo } = useTrackSelection(slug, modules);
  const { isPremium } = useQuestionLimits();
  const { data: history } = useMyMockExams(module?.id);
  const start = useStartMockExam();
  const [confirm, setConfirm] = useState(false);
  const [quotaUntil, setQuotaUntil] = useState<string | null>(null);

  const minutes = track.rules.duracao_minutos ?? DEFAULT_MINUTES;
  const passMark = track.rules.nota_minima ?? DEFAULT_PASS_MARK;
  const open = history?.find((h) => !h.finished_at && new Date(h.deadline).getTime() > Date.now());
  const finished = (history ?? []).filter((h) => h.finished_at);
  const total = module.structure.reduce((a, s) => a + s.questoes, 0);
  const maxPoints = module.structure.reduce((a, s) => a + s.questoes * s.pontos_por_questao, 0);

  const begin = () => {
    if (!cargo) return;
    start.mutate({ moduleId: module.id, cargo }, {
      onSuccess: (res) => {
        if ('exam_id' in res) {
          navigate(`/trilhas/${slug}/simulado?exam=${res.exam_id}`);
        } else if (res.error === 'free_quota' && 'next_free_at' in res) {
          setConfirm(false);
          setQuotaUntil(res.next_free_at);
        } else {
          toast.error('Não foi possível iniciar o simulado. Tente de novo.');
        }
      },
      onError: () => toast.error('Não foi possível iniciar o simulado. Verifique sua conexão.'),
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
            <p className="text-xs text-muted-foreground">{track.short_name}</p>
            <h1 className="font-display font-bold text-xl leading-tight">Simulado Oficial</h1>
          </div>
        </div>

        <Card variant="primary">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary-foreground/85 text-sm font-medium">
              <ClipboardCheck className="w-4 h-4" /> A prova inteira, no formato do edital
            </div>
            <p className="text-sm text-primary-foreground/90">
              {total} questões em {Math.floor(minutes / 60)}h{minutes % 60 ? String(minutes % 60).padStart(2, '0') : ''} de prova, sem gabarito até você finalizar.
              A nota usa os pesos do edital (até {maxPoints.toLocaleString('pt-BR')} pontos) e a regra de habilitação:
              no mínimo {passMark} pontos sem zerar nenhuma área.
            </p>
          </CardContent>
        </Card>

        <Tabs value={module.slug} onValueChange={setModule}>
          <TabsList className="grid w-full grid-cols-2">
            {modules.map((m) => <TabsTrigger key={m.slug} value={m.slug}>{m.name}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="cargo-simulado">Seu cargo</label>
          <Select value={cargo ?? undefined} onValueChange={setCargo}>
            <SelectTrigger id="cargo-simulado"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
            <SelectContent>{module.cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium p-3">Área</th>
                  <th className="text-right font-medium p-3">Questões</th>
                  <th className="text-right font-medium p-3">Peso</th>
                  <th className="text-right font-medium p-3">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {module.structure.map((a) => (
                  <tr key={a.area} className="border-b last:border-0">
                    <td className="p-3">{a.area}</td>
                    <td className="p-3 text-right tabular-nums">{a.questoes}</td>
                    <td className="p-3 text-right tabular-nums">{a.pontos_por_questao.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right tabular-nums">{(a.questoes * a.pontos_por_questao).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {open ? (
          <Button variant="hero" size="xl" className="w-full" onClick={() => navigate(`/trilhas/${slug}/simulado?exam=${open.id}`)}>
            <Play className="w-5 h-5 mr-2" /> Continuar simulado em andamento
          </Button>
        ) : (
          <Button variant="hero" size="xl" className="w-full" disabled={!cargo || start.isPending} onClick={() => setConfirm(true)}>
            {start.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
            Começar Simulado Oficial
          </Button>
        )}
        {!isPremium && (
          <p className="text-xs text-muted-foreground text-center">
            No plano gratuito: {LIMITS.freeMockExamsPerMonth} Simulado Oficial por mês. No Plus, quantos quiser.
          </p>
        )}

        {quotaUntil && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 space-y-3">
              <p className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-amber-600" /> Seu simulado gratuito do mês já foi usado</p>
              <p className="text-sm text-muted-foreground">
                O próximo gratuito libera em {new Date(quotaUntil).toLocaleDateString('pt-BR')}. No Plus você faz quantos quiser e vê sua posição entre os candidatos do cargo.
              </p>
              <Button asChild className="w-full"><Link to="/upgrade"><Crown className="w-4 h-4 mr-2" /> Conhecer o Plus</Link></Button>
            </CardContent>
          </Card>
        )}

        {finished.length > 0 && (
          <section className="space-y-2" aria-labelledby="hist">
            <h2 id="hist" className="font-semibold">Seus simulados</h2>
            {finished.map((h) => (
              <Link key={h.id} to={`/trilhas/${slug}/simulado/${h.id}`} className="block">
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-12">{fmtDate(h.finished_at!)}</span>
                    <span className="flex-1 min-w-0 text-sm truncate">{h.cargo}</span>
                    <span className="font-bold tabular-nums">{Number(h.score ?? 0).toLocaleString('pt-BR')}</span>
                    <Badge variant="outline" className={h.approved ? 'border-success/50 text-success' : 'border-destructive/50 text-destructive'}>
                      {h.approved ? 'Habilitado' : 'Não habilitado'}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </section>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Começar agora?</AlertDialogTitle>
            <AlertDialogDescription>
              O cronômetro de {minutes} minutos começa ao confirmar e não para se você fechar o app. Suas respostas
              ficam salvas e você pode voltar até o tempo acabar. Cargo: {cargo}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={begin}>Começar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Prova em andamento.
// ============================================================================
function useFlags(examId: string) {
  const key = `levelup:mock-flags:${examId}`;
  const [flags, setFlags] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set(); }
  });
  const toggle = (id: string) => setFlags((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    try { sessionStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });
  return { flags, toggle };
}

function MockRunner({ slug, examId, modules }: { slug: string; examId: string; modules: TrackModule[] }) {
  const navigate = useNavigate();
  const { data: meta, isLoading: metaLoading } = useMockExamMeta(examId);
  const { data: questions, isLoading } = useMockExamQuestions(examId, !!meta && !meta.finished_at);
  const finish = useFinishMockExam();
  const { flags, toggle } = useFlags(examId);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const finishingRef = useRef(false);
  const module = modules.find((m) => m.id === meta?.module_id);
  const names = useMemo(() => subjectNames(module), [module]);

  // Respostas já salvas (retomada).
  useEffect(() => {
    if (!questions) return;
    setAnswers((prev) => {
      const next = { ...prev };
      for (const q of questions) if (!(q.question_id in next)) next[q.question_id] = q.selected_index;
      return next;
    });
  }, [questions]);

  const deadline = meta ? new Date(meta.deadline).getTime() : null;
  const remaining = deadline ? deadline - now : null;

  const doFinish = useCallback((reason: 'user' | 'time') => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    finish.mutate(examId, {
      onSuccess: () => {
        if (reason === 'time') toast.info('Tempo esgotado. Sua prova foi entregue.');
        navigate(`/trilhas/${slug}/simulado/${examId}`, { replace: true });
      },
      onError: () => {
        finishingRef.current = false;
        toast.error('Não foi possível entregar a prova. Verifique a conexão e tente de novo.');
      },
    });
  }, [examId, finish, navigate, slug]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && meta && !meta.finished_at) doFinish('time');
  }, [remaining, meta, doFinish]);

  // Simulado já entregue (link antigo): vai para o resultado.
  useEffect(() => {
    if (meta?.finished_at) navigate(`/trilhas/${slug}/simulado/${examId}`, { replace: true });
  }, [meta?.finished_at, navigate, slug, examId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (saving.size > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saving.size]);

  const choose = async (q: MockExamQuestion, selected: number) => {
    const value = answers[q.question_id] === selected ? null : selected; // tocar de novo desmarca
    setAnswers((a) => ({ ...a, [q.question_id]: value }));
    setSaving((s) => new Set(s).add(q.question_id));
    try {
      await saveMockAnswer(examId, q.question_id, value);
      setFailed((f) => { const n = new Set(f); n.delete(q.question_id); return n; });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'time_up' || code === 'finished') { doFinish('time'); return; }
      setFailed((f) => new Set(f).add(q.question_id));
      toast.error('Resposta não salva. Toque de novo na alternativa quando a conexão voltar.');
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(q.question_id); return n; });
    }
  };

  const list = questions ?? [];
  const current = list[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || confirmFinish) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const idx = 'abcde'.indexOf(k);
      if (idx >= 0 && idx < current.alternativas.length) { e.preventDefault(); void choose(current, idx); }
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(list.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, list.length, confirmFinish, answers]);

  if (metaLoading || isLoading || !meta) return <FullPageSpinner />;
  if (!current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">Não encontramos este simulado.</p>
        <Button variant="outline" onClick={() => navigate(`/trilhas/${slug}/simulado`)}>Voltar</Button>
      </div>
    );
  }

  const answered = list.filter((q) => answers[q.question_id] !== null && answers[q.question_id] !== undefined).length;
  const unanswered = list.length - answered;
  const flaggedCount = list.filter((q) => flags.has(q.question_id)).length;
  const lowTime = remaining !== null && remaining < 10 * 60_000;
  const areaStart = list.findIndex((q) => q.area === current.area);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Simulado Oficial · {meta.cargo}</p>
            <Progress value={(answered / list.length) * 100} className="h-1.5 mt-1" aria-label={`${answered} de ${list.length} respondidas`} />
          </div>
          <span className={cn('flex items-center gap-1 text-sm font-semibold tabular-nums', lowTime && 'text-destructive')} aria-label="Tempo restante">
            <Clock className="w-4 h-4" /> {remaining !== null ? fmtClock(remaining) : '—'}
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap} aria-label="Mapa da prova">
            <Grid3x3 className="w-4 h-4" />
          </Button>
        </div>
        {showMap && (
          <div className="max-w-3xl mx-auto px-4 pb-3">
            <div className="grid grid-cols-10 gap-1.5">
              {list.map((q, i) => {
                const done = answers[q.question_id] !== null && answers[q.question_id] !== undefined;
                return (
                  <button
                    key={q.question_id}
                    onClick={() => { setIndex(i); setShowMap(false); }}
                    className={cn(
                      'relative h-8 rounded-md text-xs font-medium tabular-nums border',
                      i === index ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                      done ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground',
                      failed.has(q.question_id) && 'bg-destructive/15 text-destructive',
                    )}
                    aria-label={`Questão ${i + 1}${done ? ', respondida' : ''}${flags.has(q.question_id) ? ', marcada para revisar' : ''}`}
                  >
                    {i + 1}
                    {flags.has(q.question_id) && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {answered} respondidas · {unanswered} em branco · {flaggedCount} marcadas para revisar
            </p>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        {index === areaStart && (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{current.area}</p>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Questão {index + 1} de {list.length} · {names.get(current.subject_id) ?? current.area} · vale {Number(current.points).toLocaleString('pt-BR')}
          </p>
          <button
            onClick={() => toggle(current.question_id)}
            className={cn('flex items-center gap-1 text-xs font-medium shrink-0', flags.has(current.question_id) ? 'text-amber-600' : 'text-muted-foreground')}
            aria-pressed={flags.has(current.question_id)}
          >
            {flags.has(current.question_id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            Revisar depois
          </button>
        </div>

        <p className="text-base leading-relaxed whitespace-pre-line">{current.enunciado}</p>

        <div className="space-y-2" role="radiogroup" aria-label="Alternativas">
          {current.alternativas.map((alt, i) => {
            const selected = answers[current.question_id] === i;
            return (
              <button
                key={i}
                role="radio"
                aria-checked={selected}
                onClick={() => void choose(current, i)}
                className={cn(
                  'w-full flex gap-3 text-left rounded-xl border p-3 transition-colors',
                  selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                )}
              >
                <span className={cn('w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold', selected ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {letter(i)}
                </span>
                <span className="flex-1 text-sm pt-0.5">{alt}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          {saving.has(current.question_id) ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
            : failed.has(current.question_id) ? <span className="text-destructive">Não salva. Toque na alternativa de novo.</span>
            : answers[current.question_id] !== null && answers[current.question_id] !== undefined ? 'Resposta salva. Toque de novo para desmarcar.'
            : 'Atalhos: A–D para marcar, ← → para navegar.'}
        </p>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} aria-label="Questão anterior">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {index < list.length - 1 ? (
            <Button className="flex-1" onClick={() => setIndex((i) => i + 1)}>
              Próxima <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button className="flex-1" variant="hero" onClick={() => setConfirmFinish(true)}>Entregar prova</Button>
          )}
          {index < list.length - 1 && (
            <Button variant="outline" onClick={() => setConfirmFinish(true)}>Entregar</Button>
          )}
        </div>
      </footer>

      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entregar a prova?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered > 0 ? `${unanswered} questão(ões) em branco contam como erro. ` : 'Todas as questões respondidas. '}
              {flaggedCount > 0 ? `${flaggedCount} marcada(s) para revisar. ` : ''}
              Depois de entregar não dá para mudar as respostas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar à prova</AlertDialogCancel>
            <AlertDialogAction disabled={finish.isPending || saving.size > 0} onClick={() => doFinish('user')}>
              {finish.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Resultado.
// ============================================================================
function MockResult({ slug, examId, modules, passMark }: { slug: string; examId: string; modules: TrackModule[]; passMark: number }) {
  const navigate = useNavigate();
  const { data: meta } = useMockExamMeta(examId);
  const { data: result, isLoading, isError } = useMockExamResult(examId, !!meta?.finished_at);
  const { data: questions } = useMockExamQuestions(examId, !!meta?.finished_at);
  const { data: standing } = useMockStanding(meta?.finished_at ? examId : undefined);
  const { isPremium } = useQuestionLimits();
  const [filter, setFilter] = useState<'wrong' | 'all'>('wrong');
  const [reportId, setReportId] = useState<string | null>(null);
  const module = modules.find((m) => m.id === meta?.module_id);
  const names = useMemo(() => subjectNames(module), [module]);

  useEffect(() => {
    if (meta && !meta.finished_at) navigate(`/trilhas/${slug}/simulado?exam=${examId}`, { replace: true });
  }, [meta, navigate, slug, examId]);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">Não foi possível carregar este resultado.</p>
        <Button variant="outline" onClick={() => navigate(`/trilhas/${slug}/simulado`)}>Voltar</Button>
      </div>
    );
  }
  if (isLoading || !result || !meta) return <FullPageSpinner />;

  const byId = new Map((questions ?? []).map((q) => [q.question_id, q]));
  const review = result.items.map((it) => {
    const q = byId.get(it.question_id);
    return {
      ...it,
      enunciado: q?.enunciado ?? '',
      alternativas: q?.alternativas ?? [],
      categoria: (q && names.get(q.subject_id)) ?? it.area,
      selected: it.selected_index,
      correctIndex: it.correct_index,
    };
  });
  const wrong = review.filter((r) => !r.is_correct);
  const shown = filter === 'wrong' ? wrong : review;
  const zeroed = result.areas.filter((a) => a.acertos === 0).map((a) => a.area);
  const reason = result.approved
    ? `Você atingiu ${Number(result.score).toLocaleString('pt-BR')} pontos sem zerar nenhuma área.`
    : zeroed.length > 0
      ? `Você zerou ${zeroed.join(' e ')}. O edital elimina quem zera uma área.`
      : `Faltaram ${(passMark - Number(result.score)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} pontos para o mínimo de ${passMark}.`;
  const mins = Math.round(result.duration_seconds / 60);

  return (
    <div className="min-h-screen bg-background pb-12 print:bg-white">
      <PrintableReview
        title={`Simulado Oficial · ${meta.cargo}`}
        summary={[
          `Nota ${Number(result.score).toLocaleString('pt-BR')} de 100 · ${result.correct}/${result.total} acertos · ${result.approved ? 'habilitado' : 'não habilitado'}`,
          ...result.areas.map((a) => `${a.area}: ${a.acertos}/${a.questoes} (${Number(a.pontos).toLocaleString('pt-BR')} de ${Number(a.max).toLocaleString('pt-BR')} pontos)`),
        ]}
        items={review}
      />
      <div className="print:hidden">
        <AppHeader />
        <div className="px-4 pt-4 max-w-3xl mx-auto space-y-5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/trilhas/${slug}/simulado`)} aria-label="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Simulado Oficial · {meta.cargo}</p>
              <h1 className="font-display font-bold text-xl leading-tight">Resultado</h1>
            </div>
          </div>

          <Card variant="primary">
            <CardContent className="p-5 flex items-center gap-5">
              <div>
                <p className="text-5xl font-display font-bold tabular-nums leading-none">{Number(result.score).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-primary-foreground/80 mt-1">de 100 pontos · {result.correct}/{result.total} acertos · {mins} min</p>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <Badge className={result.approved ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
                  {result.approved ? 'Habilitado' : 'Não habilitado'}
                </Badge>
                <p className="text-xs text-primary-foreground/85 mt-2">{reason}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Nota por área</p>
              {result.areas.map((a) => {
                const pct = a.max > 0 ? (a.pontos / a.max) * 100 : 0;
                return (
                  <div key={a.area} className="space-y-1">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="truncate">{a.area}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {a.acertos}/{a.questoes} · {Number(a.pontos).toLocaleString('pt-BR')} de {Number(a.max).toLocaleString('pt-BR')} pts
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', a.acertos === 0 ? 'bg-destructive' : pct >= 60 ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <StandingCard standing={standing} isPremium={isPremium} />

          <Button variant="outline" size="lg" className="w-full" onClick={() => (isPremium ? window.print() : navigate('/upgrade'))}>
            <FileDown className="w-4 h-4 mr-2" /> {isPremium ? 'Baixar PDF com explicações' : 'PDF com explicações (Plus)'}
          </Button>

          <section className="space-y-3" aria-labelledby="rev">
            <div className="flex items-center justify-between gap-2">
              <h2 id="rev" className="font-display font-bold text-lg">Revisão</h2>
              <div className="flex rounded-full bg-muted p-0.5 text-xs" role="tablist">
                {(['wrong', 'all'] as const).map((f) => (
                  <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                    className={cn('px-3 py-1 rounded-full transition-colors', filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}>
                    {f === 'wrong' ? `Erros e brancos (${wrong.length})` : `Todas (${review.length})`}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Os erros entram na sua revisão espaçada e voltam nos próximos dias.</p>
            {shown.map((r) => {
              const StatusIcon = r.selected === null ? MinusCircle : r.is_correct ? CheckCircle2 : XCircle;
              return (
                <Card key={r.question_id} className={cn('border-l-4', r.is_correct ? 'border-l-success' : r.selected === null ? 'border-l-muted-foreground/40' : 'border-l-destructive')}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <StatusIcon className={cn('w-5 h-5 shrink-0 mt-0.5', r.is_correct ? 'text-success' : r.selected === null ? 'text-muted-foreground' : 'text-destructive')} />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Questão {r.pos} · {r.categoria}</p>
                        <p className="text-sm font-medium whitespace-pre-line">{r.enunciado}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {r.alternativas.map((alt, i) => (
                        <li key={i} className={cn('flex gap-2 text-sm rounded-lg px-3 py-2 border',
                          i === r.correctIndex ? 'border-success/40 bg-success/10' : i === r.selected ? 'border-destructive/40 bg-destructive/10' : 'border-transparent bg-muted/40')}>
                          <span className="font-bold w-4 shrink-0">{letter(i)}</span>
                          <span className="flex-1">{alt}</span>
                          {i === r.correctIndex && <Badge variant="outline" className="h-5 text-[10px] border-success/50 text-success">Gabarito</Badge>}
                          {i === r.selected && i !== r.correctIndex && <Badge variant="outline" className="h-5 text-[10px] border-destructive/50 text-destructive">Sua resposta</Badge>}
                        </li>
                      ))}
                    </ul>
                    {r.explicacao && (
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                        <p className="text-xs font-semibold text-primary mb-1">Explicação</p>
                        <p className="text-sm text-muted-foreground">{r.explicacao}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!r.is_correct && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/mentor?questao=${r.question_id}`)}>
                          <Bot className="w-4 h-4 mr-1.5" /> Explicar com o Mentor IA
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setReportId(r.question_id)}>
                        <Flag className="w-4 h-4 mr-1.5" /> Reportar erro
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {shown.length === 0 && (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum erro. Prova perfeita.</CardContent></Card>
            )}
          </section>
        </div>
      </div>
      <ReportQuestionDialog questionId={reportId} open={!!reportId} onOpenChange={(o) => !o && setReportId(null)} />
    </div>
  );
}

function StandingCard({ standing, isPremium }: { standing?: ReturnType<typeof useMockStanding>['data']; isPremium: boolean }) {
  if (!standing || standing.error) return null;
  if (!standing.enough_data) {
    return (
      <Card>
        <CardContent className="p-4 flex gap-3 items-start">
          <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            A comparação com outros candidatos do seu cargo aparece quando {standing.needed} pessoas tiverem feito o Simulado Oficial
            (hoje: {standing.candidates}).
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!standing.detail) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3 items-start">
            <Trophy className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm">
              Você ficou na metade <strong>{standing.above_median ? 'de cima' : 'de baixo'}</strong> entre {standing.candidates} candidatos do seu cargo.
            </p>
          </div>
          {!isPremium && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/upgrade"><Crown className="w-4 h-4 mr-2 text-amber-500" /> Ver sua posição exata no Plus</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums">{standing.position}º</p>
          <p className="text-[11px] text-muted-foreground leading-tight">de {standing.candidates} candidatos do cargo</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{standing.percentile}%</p>
          <p className="text-[11px] text-muted-foreground leading-tight">ficaram abaixo de você</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{standing.approved_share}%</p>
          <p className="text-[11px] text-muted-foreground leading-tight">estariam habilitados</p>
        </div>
        <p className="col-span-3 text-[11px] text-muted-foreground flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Melhor nota de cada aluno no simulado nos últimos 60 dias.
        </p>
      </CardContent>
    </Card>
  );
}
