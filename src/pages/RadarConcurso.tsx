import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, Hourglass, Info, Route } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadarFollowButton } from '@/components/radar/RadarFollowButton';
import { useRadarConcurso } from '@/hooks/useRadar';
import { ESFERA_LABEL, FIELD_LABEL, formatChangeValue, formatDateBr, formatMoney, STATUS_LABEL, statusTone } from '@/lib/radar';
import { cn } from '@/lib/utils';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function RadarConcurso() {
  const { slug } = useParams();
  const { data, isLoading } = useRadarConcurso(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="px-4 pt-6 max-w-3xl mx-auto space-y-3">
          <div className="h-32 rounded-2xl bg-muted/50 animate-pulse" />
          <div className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="px-4 pt-10 max-w-3xl mx-auto text-center space-y-3">
          <p className="font-medium">Concurso não encontrado no radar.</p>
          <Button asChild variant="outline"><Link to="/radar">Voltar ao radar</Link></Button>
        </div>
      </div>
    );
  }

  const { concurso: c, updates } = data;
  const place = [c.municipio, c.uf].filter(Boolean).join(' · ');
  const trackSlug = c.study_tracks?.slug;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <div className="px-4 pt-4 max-w-3xl mx-auto space-y-4">
        <Link to="/radar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Radar de concursos
        </Link>

        <header className="space-y-2">
          <Badge variant="outline" className={cn('font-medium', statusTone(c.status))}>{STATUS_LABEL[c.status]}</Badge>
          <h1 className="font-display font-bold text-2xl leading-tight">{c.nome}</h1>
          <p className="text-sm text-muted-foreground">{c.orgao}{c.banca ? ` · Banca: ${c.banca}` : ''}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <RadarFollowButton concursoId={c.id} label={c.nome} size="default" />
            {c.link_oficial && (
              <Button asChild variant="ghost" className="gap-1.5">
                <a href={c.link_oficial} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Página oficial
                </a>
              </Button>
            )}
          </div>
        </header>

        {/* Trilha */}
        {trackSlug ? (
          <Card variant="elevated" className="border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Route className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Trilha de estudos pronta</p>
                <p className="text-sm text-muted-foreground">Matérias do edital, pesos da prova e questões no padrão da banca.</p>
              </div>
              <Button asChild><Link to={`/trilhas/${trackSlug}`}>Estudar</Link></Button>
            </CardContent>
          </Card>
        ) : c.track_suggested ? (
          <Card>
            <CardContent className="p-4 flex items-center gap-3 text-sm">
              <Hourglass className="w-6 h-6 text-primary shrink-0" />
              <p>A trilha deste concurso está em preparação a partir do edital. Acompanhe para ser avisado quando sair.</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Dados */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(c.esfera || place) && <Fact label="Abrangência" value={[c.esfera ? ESFERA_LABEL[c.esfera] : null, place].filter(Boolean).join(' · ')} />}
              {c.vagas !== null && <Fact label="Vagas" value={c.vagas === 0 ? 'Cadastro reserva' : c.vagas.toLocaleString('pt-BR')} />}
              {c.salario_max !== null && <Fact label="Salário inicial (até)" value={formatMoney(c.salario_max)} />}
              {c.escolaridade.length > 0 && (
                <Fact label="Escolaridade" value={c.escolaridade.map((e) => (e === 'medio' ? 'médio' : e)).join(', ')} />
              )}
              {c.inscricoes_inicio && <Fact label="Inscrições a partir de" value={formatDateBr(c.inscricoes_inicio)} />}
              {c.inscricoes_fim && <Fact label="Inscrições até" value={formatDateBr(c.inscricoes_fim)} />}
              {c.data_prova && <Fact label="Prova" value={formatDateBr(c.data_prova)} />}
            </dl>
            {c.cargos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-1">Cargos</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.cargos.map((cargo) => <Badge key={cargo} variant="secondary" className="font-normal">{cargo}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linha do tempo */}
        <section aria-labelledby="atualizacoes" className="space-y-2">
          <h2 id="atualizacoes" className="font-semibold">Atualizações</h2>
          {updates.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma atualização ainda. Quando a fonte oficial mudar, ela aparece aqui.</p>
          )}
          <ol className="space-y-2">
            {updates.map((u) => (
              <li key={u.id}>
                <Card className={cn(u.severity === 'critica' && 'border-primary/40')}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      {u.severity === 'critica'
                        ? <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-label="Importante" />
                        : <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-snug">{u.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {u.changes?.length > 0 && (
                      <ul className="text-sm space-y-1 pl-6">
                        {u.changes.map((ch, i) => (
                          <li key={i}>
                            <span className="text-muted-foreground">{FIELD_LABEL[ch.campo] ?? ch.campo}:</span>{' '}
                            {ch.antes !== null && ch.antes !== undefined && (
                              <><span className="line-through text-muted-foreground">{formatChangeValue(ch.campo, ch.antes)}</span>{' → '}</>
                            )}
                            <span className="font-medium">{formatChangeValue(ch.campo, ch.depois)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!u.changes?.length && u.summary && <p className="text-sm pl-6">{u.summary}</p>}
                    {u.evidence_url && (
                      <a
                        href={u.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary pl-6 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" /> Ver na fonte oficial
                      </a>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-muted-foreground">
          Informações coletadas de fontes oficiais e conferidas por verificação independente. Confirme sempre no edital
          antes de se inscrever.
        </p>
      </div>
    </div>
  );
}
