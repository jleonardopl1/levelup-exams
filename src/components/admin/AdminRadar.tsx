import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ExternalLink, FileText, Loader2, Play, Plus, Radar, Route, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRadarAreas } from '@/hooks/useRadar';
import {
  type AdminRadarConcurso,
  useAddRadarSource,
  useAdminRadarDrafts,
  useAdminRadarPending,
  useAdminRadarRuns,
  useAdminRadarSources,
  useAdminRadarSuggested,
  useGenerateTrackDraft,
  usePublishTrackDraft,
  useRejectTrackDraft,
  useReviewRadarUpdate,
  useRunRadar,
  useToggleRadarSource,
} from '@/hooks/useAdminRadar';
import { FIELD_LABEL, formatChangeValue, STATUS_LABEL } from '@/lib/radar';

const ago = (iso: string | null) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }) : 'nunca');

/** Mensagem de erro de uma Edge Function (o corpo JSON traz { error }). */
async function functionError(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  try {
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    if (body?.error) return String(body.error);
  } catch { /* corpo não é JSON */ }
  return err instanceof Error ? err.message : 'Erro desconhecido';
}

/**
 * Painel do Radar de Concursos: o admin acompanha o grupo de agentes (gerente master,
 * coordenadores de área e especialistas), revisa o que não pôde ser publicado sozinho,
 * gera e publica rascunhos de trilha e gerencia as fontes oficiais monitoradas.
 */
export function AdminRadar() {
  return (
    <div className="space-y-4">
      <RunsCard />
      <PendingCard />
      <TracksCard />
      <SourcesCard />
    </div>
  );
}

function RunsCard() {
  const { data: runs, isLoading } = useAdminRadarRuns();
  const run = useRunRadar();
  const start = () =>
    run.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          `${r.sources_checked} fonte(s) verificada(s), ${r.sources_changed} com novidade: ${r.updates_published} publicada(s), ${r.updates_pending} para revisão.`,
          r.degraded?.length ? { description: `Degradado: ${r.degraded.slice(0, 3).join('; ')}` } : undefined,
        ),
      onError: async (e) => toast.error('Falha ao executar o radar', { description: await functionError(e) }),
    });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-1.5"><Radar className="w-4 h-4 text-primary" /> Radar de concursos</p>
            <p className="text-xs text-muted-foreground">
              Gerente master → coordenador de cada área → batedor, analista de edital e verificador independente. Roda a cada 3 horas.
            </p>
          </div>
          <Button size="sm" onClick={start} disabled={run.isPending} className="gap-1.5 shrink-0">
            {run.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Verificar agora
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : runs?.length ? (
          <ul className="text-sm space-y-1">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{ago(r.started_at)} · {r.trigger === 'cron' ? 'agendada' : 'manual'}</span>
                <span className="text-xs flex gap-2">
                  <span>{r.sources_checked} fontes</span>
                  <span>{r.updates_published} publ.</span>
                  <span>{r.updates_pending} rev.</span>
                  {r.errors > 0 && <Badge variant="destructive" className="text-[10px]">{r.errors} erro(s)</Badge>}
                  {!r.finished_at && <Badge variant="outline" className="text-[10px]">em andamento</Badge>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PendingCard() {
  const { data: pending, isLoading } = useAdminRadarPending();
  const review = useReviewRadarUpdate();
  const decide = (id: string, approve: boolean) =>
    review.mutate(
      { id, approve },
      {
        onSuccess: (n) => toast.success(approve ? `Publicada. ${n} aluno(s) avisado(s).` : 'Atualização rejeitada.'),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha na revisão'),
      },
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Para revisão humana
          {!!pending?.length && <Badge variant="destructive">{pending.length}</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mudanças de fase para trás, retificações de data, documentos alterados e tudo o que o verificador não confirmou.
          Confira na fonte antes de aprovar: aprovar publica e avisa quem acompanha.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />}
        {!isLoading && !pending?.length && <p className="text-sm text-muted-foreground">Nada pendente.</p>}
        {pending?.map((u) => (
          <div key={u.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{u.title}</p>
                <p className="text-xs text-muted-foreground">
                  {u.radar_concursos?.nome}{u.radar_concursos && !u.radar_concursos.is_published ? ' · ainda não publicado' : ''} · {ago(u.created_at)}
                </p>
              </div>
              <Badge variant={u.severity === 'critica' ? 'default' : 'secondary'} className="shrink-0">{u.kind}</Badge>
            </div>
            {u.review_reason && <p className="text-xs text-amber-700 dark:text-amber-400">Motivo: {u.review_reason}</p>}
            {u.changes?.length > 0 && (
              <ul className="text-xs space-y-1">
                {u.changes.map((ch, i) => (
                  <li key={i}>
                    <span className="font-medium">{FIELD_LABEL[ch.campo] ?? ch.campo}:</span>{' '}
                    {ch.antes != null ? `${formatChangeValue(ch.campo, ch.antes)} → ` : ''}{formatChangeValue(ch.campo, ch.depois)}
                    {ch.evidencia && <span className="block text-muted-foreground italic">“{ch.evidencia}”</span>}
                  </li>
                ))}
              </ul>
            )}
            {!u.changes?.length && u.summary && <p className="text-xs">{u.summary}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {u.evidence_url && (
                <a href={u.evidence_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline mr-auto">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir fonte
                </a>
              )}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => decide(u.id, false)} disabled={review.isPending}>
                <X className="w-4 h-4" /> Rejeitar
              </Button>
              <Button size="sm" className="gap-1" onClick={() => decide(u.id, true)} disabled={review.isPending}>
                <Check className="w-4 h-4" /> Aprovar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TracksCard() {
  const { data: suggested } = useAdminRadarSuggested();
  const { data: drafts } = useAdminRadarDrafts();
  const generate = useGenerateTrackDraft();
  const publish = usePublishTrackDraft();
  const reject = useRejectTrackDraft();
  const [target, setTarget] = useState<AdminRadarConcurso | null>(null);
  const [edital, setEdital] = useState('');

  const runDraft = () => {
    if (!target) return;
    generate.mutate(
      { concursoId: target.id, editalText: edital.trim() || undefined },
      {
        onSuccess: (r) => {
          if (r.status === 'falhou') toast.error('Rascunho não gerado', { description: r.error ?? undefined });
          else toast.success('Rascunho de trilha pronto para revisão', { description: r.warnings.length ? `${r.warnings.length} aviso(s)` : undefined });
          setTarget(null);
          setEdital('');
        },
        onError: async (e) => toast.error('Falha ao gerar o rascunho', { description: await functionError(e) }),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4 text-primary" /> Novas trilhas</CardTitle>
        <p className="text-xs text-muted-foreground">
          O analista de banca e o arquiteto de trilha montam módulos, matérias e ementas a partir do edital. Só entra o que
          confere com o texto do edital; legislação local começa sem geração automática até haver questões autorais.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Concursos sem trilha</p>
          {!suggested?.length && <p className="text-sm text-muted-foreground">Nenhum concurso com edital aguardando trilha.</p>}
          {suggested?.slice(0, 8).map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{c.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS_LABEL[c.status]} · relevância {c.relevance}{c.track_suggested ? ' · sugerido' : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setTarget(c)}>Gerar rascunho</Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rascunhos</p>
          {!drafts?.length && <p className="text-sm text-muted-foreground">Nenhum rascunho ainda.</p>}
          {drafts?.map((d) => (
            <div key={d.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{d.draft?.name ?? d.radar_concursos?.nome}</p>
                  <p className="text-xs text-muted-foreground">{ago(d.created_at)}</p>
                </div>
                <Badge variant={d.status === 'pendente_revisao' ? 'default' : d.status === 'publicada' ? 'secondary' : 'outline'}>
                  {d.status.replace('_', ' ')}
                </Badge>
              </div>
              {d.error && <p className="text-xs text-destructive">{d.error}</p>}
              {d.draft?.modules?.map((m) => (
                <div key={m.nivel} className="text-xs">
                  <span className="font-medium">{m.name}:</span>{' '}
                  {m.subjects.map((s) => `${s.name}${s.weekly_target === 0 ? ' (sem geração automática)' : ''}`).join(' · ')}
                </div>
              ))}
              {d.warnings?.length > 0 && (
                <details className="text-xs text-amber-700 dark:text-amber-400">
                  <summary className="cursor-pointer">{d.warnings.length} aviso(s) do portão</summary>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">{d.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}
              {d.status === 'pendente_revisao' && (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={reject.isPending} onClick={() => reject.mutate(d.id, { onSuccess: () => toast.success('Rascunho rejeitado') })}>
                    Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    disabled={publish.isPending}
                    onClick={() =>
                      publish.mutate(d.id, {
                        onSuccess: () => toast.success('Trilha publicada. A fábrica de questões começa na próxima janela.'),
                        onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha ao publicar'),
                      })}
                  >
                    Publicar trilha
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rascunho de trilha</DialogTitle>
            <DialogDescription>
              {target?.nome}. Cole o texto do edital (quadro de provas e conteúdo programático). Se o link oficial for uma
              página HTML com o edital, pode deixar em branco.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={edital}
            onChange={(e) => setEdital(e.target.value)}
            rows={10}
            placeholder="Cole aqui o texto do edital…"
            aria-label="Texto do edital"
            maxLength={150_000}
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> {edital.length.toLocaleString('pt-BR')} caracteres · leva até 2 minutos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={runDraft} disabled={generate.isPending} className="gap-1.5">
              {generate.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SourcesCard() {
  const { data: sources, isLoading } = useAdminRadarSources();
  const { data: areas } = useRadarAreas();
  const toggle = useToggleRadarSource();
  const add = useAddRadarSource();
  const run = useRunRadar();
  const [form, setForm] = useState({ name: '', url: '', kind: 'banca', area_id: 'geral', check_interval_hours: 12 });
  const areaName = (id: string | null) => areas?.find((a) => a.id === id)?.name ?? 'Geral (o batedor classifica)';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https:\/\/\S+\.\S+/.test(form.url.trim())) {
      toast.error('Use um endereço https:// oficial.');
      return;
    }
    add.mutate(
      { ...form, url: form.url.trim(), name: form.name.trim() || form.url.trim(), area_id: form.area_id === 'geral' ? null : form.area_id },
      {
        onSuccess: () => {
          toast.success('Fonte adicionada. Ela entra na próxima verificação.');
          setForm({ name: '', url: '', kind: 'banca', area_id: 'geral', check_interval_hours: 12 });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Falha ao adicionar'),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fontes oficiais monitoradas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Páginas de bancas, órgãos e diários oficiais. O coletor respeita o robots.txt e só lê endereços https públicos.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />}
        <ul className="space-y-2">
          {sources?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <Switch
                checked={s.is_active}
                onCheckedChange={(v) => toggle.mutate({ id: s.id, is_active: v })}
                aria-label={`Monitorar ${s.name}`}
              />
              <div className="flex-1 min-w-0">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium truncate block hover:underline">{s.name}</a>
                <p className="text-xs text-muted-foreground truncate">
                  {areaName(s.area_id)} · a cada {s.check_interval_hours} h · visto {ago(s.last_checked_at)}
                  {s.last_changed_at ? ` · mudou ${ago(s.last_changed_at)}` : ''}
                </p>
              </div>
              {s.last_status && s.last_status !== 'ok' && (
                <Badge variant={s.consecutive_failures > 0 ? 'destructive' : 'outline'} className="text-[10px] max-w-28 truncate">
                  {s.last_status}
                </Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Verificar ${s.name} agora`}
                disabled={run.isPending || !s.is_active}
                onClick={() =>
                  run.mutate(s.id, {
                    onSuccess: (r) => toast.success(r.sources_changed ? 'Fonte com novidade processada.' : 'Sem novidade nesta fonte.'),
                    onError: async (e) => toast.error('Falha', { description: await functionError(e) }),
                  })}
              >
                <Play className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2 border-t pt-3">
          <Input placeholder="Nome (ex.: Polícia Federal — concursos)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Nome da fonte" />
          <Input placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label="Endereço da fonte" required />
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="banca">Banca</SelectItem>
              <SelectItem value="orgao">Órgão</SelectItem>
              <SelectItem value="diario_oficial">Diário oficial</SelectItem>
              <SelectItem value="agregador">Agregador</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
            <SelectTrigger aria-label="Área"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Geral (o batedor classifica)</SelectItem>
              {areas?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(form.check_interval_hours)} onValueChange={(v) => setForm({ ...form, check_interval_hours: Number(v) })}>
            <SelectTrigger aria-label="Frequência"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 6, 12, 24, 48, 168].map((h) => <SelectItem key={h} value={String(h)}>A cada {h < 24 ? `${h} h` : `${h / 24} dia(s)`}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={add.isPending} className="gap-1.5"><Plus className="w-4 h-4" /> Adicionar fonte</Button>
        </form>
      </CardContent>
    </Card>
  );
}
