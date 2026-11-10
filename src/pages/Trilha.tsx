import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ArrowLeft, CalendarClock, Target, RotateCcw, Sparkles, Play, FileText, Bot,
  Gauge, AlertTriangle, CheckCircle2, ExternalLink, ListChecks,
} from 'lucide-react';
import {
  daysUntil, useStudyTrack, useTrackProgress,
  type SubjectProgress, type TrackModule, type TrackSubject,
} from '@/hooks/useStudyTracks';

const PASS_MARK = 40;

function readPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* armazenamento indisponivel */ }
}

function accuracyOf(p?: SubjectProgress): number | null {
  if (!p || p.answered === 0) return null;
  return p.correct_latest / p.answered;
}

/** Projeção de nota: aplica o acerto médio de cada área ao peso da área no edital. */
function projectScore(module: TrackModule, subjects: TrackSubject[], progress?: Map<string, SubjectProgress>) {
  let projected = 0;
  let covered = 0;
  const areas = module.structure.map((area) => {
    const inArea = subjects.filter((s) => s.area === area.area);
    const accs = inArea.map((s) => accuracyOf(progress?.get(s.subject_id))).filter((a): a is number => a !== null);
    const acc = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null;
    const max = area.questoes * area.pontos_por_questao;
    if (acc !== null) { projected += acc * max; covered += max; }
    return { ...area, max, acc };
  });
  return { projected: Math.round(projected * 10) / 10, covered, areas };
}

export default function Trilha() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useStudyTrack(slug);

  const [moduleSlug, setModuleSlug] = useState<string | null>(() => readPref(`trilha:${slug}:modulo`));
  const modules = data?.modules ?? [];
  const module = modules.find((m) => m.slug === moduleSlug) ?? modules[0];

  const [cargo, setCargo] = useState<string | null>(() => readPref(`trilha:${slug}:cargo`));
  const cargoValid = module && cargo && module.cargos.includes(cargo) ? cargo : module?.cargos[0] ?? null;

  const { data: progress } = useTrackProgress(module?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const visibleSubjects = useMemo(
    () => (module?.subjects ?? []).filter((s) => !s.cargo || s.cargo === cargoValid),
    [module, cargoValid],
  );

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data || !module) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="p-6 text-center space-y-3">
          <p className="text-muted-foreground">Trilha não encontrada.</p>
          <Button variant="outline" onClick={() => navigate('/trilhas')}>Ver trilhas disponíveis</Button>
        </div>
      </div>
    );
  }

  const { track } = data;
  const days = daysUntil(track.exam_date);
  const score = projectScore(module, visibleSubjects, progress);
  const totals = visibleSubjects.reduce(
    (acc, s) => {
      const p = progress?.get(s.subject_id);
      acc.answered += p?.answered ?? 0;
      acc.total += p?.total_questions ?? 0;
      acc.wrong += p?.wrong_latest ?? 0;
      acc.newWeek += p?.new_this_week ?? 0;
      return acc;
    },
    { answered: 0, total: 0, wrong: 0, newWeek: 0 },
  );

  // Prioridade de estudo: áreas de maior peso e matérias com menor acerto/cobertura primeiro.
  const priority = [...visibleSubjects]
    .map((s) => {
      const p = progress?.get(s.subject_id);
      const area = module.structure.find((a) => a.area === s.area);
      const weight = area ? area.pontos_por_questao : 1;
      const coverage = p && p.total_questions ? p.answered / p.total_questions : 0;
      const acc = accuracyOf(p) ?? 0;
      return { s, p, rank: weight * (1 - acc) + (1 - coverage) * 0.5 };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);

  const practice = (s: TrackSubject, mode: 'smart' | 'review' | 'weekly') => {
    const params = new URLSearchParams({ subject: s.subject_id, nivel: module.nivel, mode, trilha: track.slug });
    navigate(`/quiz?${params.toString()}`);
  };

  const areas = module.structure.map((a) => a.area);

  return (
    <div className="min-h-screen bg-background pb-12">
      <AppHeader />

      <div className="px-4 pt-4 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/trilhas')} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{track.banca}</p>
            <h1 className="font-display font-bold text-xl leading-tight">{track.short_name}</h1>
          </div>
        </div>

        {/* Contagem regressiva e projeção */}
        <Card variant="primary">
          <CardContent className="p-5 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-primary-foreground/80 text-xs font-medium">
                <CalendarClock className="w-4 h-4" /> Prova
              </div>
              <p className="text-3xl font-bold leading-none mt-1">
                {days === null ? '—' : days > 0 ? days : days === 0 ? 'Hoje' : 'Realizada'}
              </p>
              <p className="text-xs text-primary-foreground/80 mt-1">
                {days !== null && days > 0 ? 'dias restantes' : ''}
                {track.exam_date ? ` · ${track.exam_date.split('-').reverse().join('/')}` : ''}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-primary-foreground/80 text-xs font-medium">
                <Gauge className="w-4 h-4" /> Projeção de nota
              </div>
              <p className="text-3xl font-bold leading-none mt-1">
                {score.covered > 0 ? score.projected.toLocaleString('pt-BR') : '—'}
                <span className="text-base font-medium text-primary-foreground/80">/100</span>
              </p>
              <p className="text-xs text-primary-foreground/80 mt-1">
                {score.covered === 0
                  ? 'Responda questões para calcular'
                  : score.covered < 100
                    ? `com base em ${score.covered} dos 100 pontos`
                    : score.projected >= PASS_MARK ? 'acima do mínimo de 40' : 'abaixo do mínimo de 40'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nível */}
        <Tabs
          value={module.slug}
          onValueChange={(v) => { setModuleSlug(v); writePref(`trilha:${slug}:modulo`, v); }}
        >
          <TabsList className="grid w-full grid-cols-2">
            {modules.map((m) => (
              <TabsTrigger key={m.slug} value={m.slug}>{m.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {module.description && <p className="text-sm text-muted-foreground">{module.description}</p>}

        {/* Cargo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="cargo">Seu cargo</label>
          <Select
            value={cargoValid ?? undefined}
            onValueChange={(v) => { setCargo(v); writePref(`trilha:${slug}:cargo`, v); }}
          >
            <SelectTrigger id="cargo"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
            <SelectContent>
              {module.cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2">
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totals.answered}<span className="text-xs text-muted-foreground">/{totals.total}</span></p>
            <p className="text-[11px] text-muted-foreground leading-tight">questões resolvidas</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-destructive">{totals.wrong}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">erros para revisar</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{totals.newWeek}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">novas nesta semana</p>
          </CardContent></Card>
        </div>

        {/* Prioridades */}
        {priority.length > 0 && (
          <Card variant="elevated">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Foco de hoje</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Ordenado pelo peso no edital (Específicos valem 1,75 ponto por questão) e pelo seu desempenho.
              </p>
              <div className="space-y-2">
                {priority.map(({ s, p }) => (
                  <button
                    key={s.id}
                    onClick={() => practice(s, p && p.wrong_latest > 0 ? 'review' : 'smart')}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 hover:border-primary/40 text-left transition-colors"
                  >
                    <span className="text-sm font-medium">{s.subject.name}</span>
                    <span className="text-xs text-primary shrink-0">
                      {p && p.wrong_latest > 0 ? `Revisar ${p.wrong_latest} erro(s)` : 'Praticar'}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Matérias por área */}
        {areas.map((areaName) => {
          const area = score.areas.find((a) => a.area === areaName)!;
          const subjects = visibleSubjects.filter((s) => s.area === areaName);
          if (!subjects.length) return null;
          return (
            <section key={areaName} className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-lg">{areaName}</h2>
                  <p className="text-xs text-muted-foreground">
                    {area.questoes} questões × {area.pontos_por_questao.toLocaleString('pt-BR')} ponto = {area.max} pontos · não pode zerar
                  </p>
                </div>
                {area.acc !== null && (
                  <Badge variant="secondary" className="shrink-0 whitespace-nowrap">{Math.round(area.acc * 100)}% de acerto</Badge>
                )}
              </div>

              {subjects.map((s) => {
                const p = progress?.get(s.subject_id);
                const acc = accuracyOf(p);
                const coverage = p && p.total_questions ? Math.round((p.answered / p.total_questions) * 100) : 0;
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold leading-snug">{s.subject.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {p ? `${p.answered} de ${p.total_questions} questões` : 'Carregando progresso…'}
                            {acc !== null && ` · ${Math.round(acc * 100)}% de acerto`}
                          </p>
                        </div>
                        {acc !== null && (acc >= 0.7
                          ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-label="Bom desempenho" />
                          : acc < 0.5 ? <AlertTriangle className="w-5 h-5 text-warning shrink-0" aria-label="Precisa reforçar" /> : null)}
                      </div>

                      <Progress value={coverage} size="sm" variant="gradient" aria-label={`Cobertura ${coverage}%`} />

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="gradient" onClick={() => practice(s, 'smart')}>
                          <Play className="w-4 h-4 mr-1" /> Praticar
                        </Button>
                        <Button size="sm" variant="outline" disabled={!p || p.wrong_latest === 0} onClick={() => practice(s, 'review')}>
                          <RotateCcw className="w-4 h-4 mr-1" /> Revisar erros{p && p.wrong_latest > 0 ? ` (${p.wrong_latest})` : ''}
                        </Button>
                        {p && p.new_this_week > 0 && (
                          <Button size="sm" variant="secondary" onClick={() => practice(s, 'weekly')}>
                            <Sparkles className="w-4 h-4 mr-1" /> Novas ({p.new_this_week})
                          </Button>
                        )}
                      </div>

                      {(s.syllabus || s.study_tips) && (
                        <Accordion type="single" collapsible>
                          <AccordionItem value="edital" className="border-b-0">
                            <AccordionTrigger className="py-1 text-sm text-primary hover:no-underline">
                              <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> Conteúdo do edital e dicas</span>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-2 text-sm">
                              {s.syllabus && <p className="text-muted-foreground whitespace-pre-line">{s.syllabus}</p>}
                              {s.study_tips && (
                                <p className="rounded-lg bg-primary/5 border border-primary/15 p-3">
                                  <span className="font-medium">Como a banca cobra: </span>{s.study_tips}
                                </p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </section>
          );
        })}

        {/* Regras e cronograma */}
        <Card variant="elevated">
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Regras que decidem a aprovação</h2>
            </div>
            {track.rules.prova_objetiva && <p><span className="font-medium">Objetiva: </span>{track.rules.prova_objetiva}</p>}
            {track.rules.aprovacao && <p><span className="font-medium">Aprovação: </span>{track.rules.aprovacao}</p>}
            {track.rules.discursiva && <p><span className="font-medium">Discursiva: </span>{track.rules.discursiva}</p>}
            {module.nivel === 'superior' && track.rules.titulos && <p><span className="font-medium">Títulos: </span>{track.rules.titulos}</p>}
            {track.rules.desempate && <p><span className="font-medium">Desempate: </span>{track.rules.desempate}</p>}
            {track.rules.cronograma && track.rules.cronograma.length > 0 && (
              <ul className="space-y-1 pt-1">
                {track.rules.cronograma.map((c) => (
                  <li key={c.data + c.evento} className="flex gap-3">
                    <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{c.data.split('-').reverse().join('/')}</span>
                    <span>{c.evento}</span>
                  </li>
                ))}
              </ul>
            )}
            {track.edital_url && (
              <a href={track.edital_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary font-medium hover:underline">
                Ler o edital completo <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Treine a discursiva com o Mentor IA</p>
              <p className="text-xs text-muted-foreground">Peça um tema do seu cargo e envie sua resposta (20 a 30 linhas) para correção.</p>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/mentor">Abrir</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
