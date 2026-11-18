import { useMemo, useState } from 'react';
import { Bell, BellRing, Radar as RadarIcon, Search, ShieldCheck } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadarConcursoCard } from '@/components/radar/RadarConcursoCard';
import { useToast } from '@/hooks/use-toast';
import { useRadarAreas, useRadarConcursos, useRadarFollows, useToggleRadarFollow } from '@/hooks/useRadar';
import { ESFERA_LABEL, type RadarEsfera } from '@/lib/radar';
import { cn } from '@/lib/utils';

const CLOSED = new Set(['prova_aplicada', 'resultado_final', 'homologado', 'cancelado']);

export default function Radar() {
  const { data: areas } = useRadarAreas();
  const { data: concursos, isLoading, isError } = useRadarConcursos();
  const { data: follows } = useRadarFollows();
  const toggle = useToggleRadarFollow();
  const { toast } = useToast();

  const [area, setArea] = useState<string>('todas');
  const [esfera, setEsfera] = useState<string>('todas');
  const [onlyMine, setOnlyMine] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');

  const followedAreas = useMemo(() => new Set((follows ?? []).map((f) => f.area_id).filter(Boolean)), [follows]);
  const followedConcursos = useMemo(() => new Set((follows ?? []).map((f) => f.concurso_id).filter(Boolean)), [follows]);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (concursos ?? []).filter((c) => {
      if (area !== 'todas' && c.area_id !== area) return false;
      if (esfera !== 'todas' && c.esfera !== esfera) return false;
      if (onlyMine && !followedConcursos.has(c.id) && !(c.area_id && followedAreas.has(c.area_id))) return false;
      if (!showClosed && CLOSED.has(c.status)) return false;
      if (term && !`${c.nome} ${c.orgao} ${c.banca ?? ''} ${c.uf ?? ''} ${c.municipio ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [concursos, area, esfera, onlyMine, showClosed, search, followedAreas, followedConcursos]);

  const toggleArea = (id: string, name: string) => {
    const follow = !followedAreas.has(id);
    toggle.mutate(
      { areaId: id, follow },
      {
        onSuccess: () =>
          toast({
            title: follow ? `Área ${name} no seu radar` : `Você deixou de acompanhar ${name}`,
            description: follow ? 'Você será avisado quando aparecer concurso novo nessa área.' : undefined,
          }),
        onError: () => toast({ title: 'Não foi possível salvar', variant: 'destructive' }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <div className="px-4 pt-6 max-w-3xl mx-auto space-y-5">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <RadarIcon className="w-6 h-6 text-primary" />
            <h1 className="font-display font-bold text-2xl">Radar de concursos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Concursos previstos, autorizados e com edital na rua, acompanhados nas fontes oficiais. Acompanhe os seus e
            receba aviso de edital, inscrições, datas e retificações.
          </p>
        </header>

        {/* Áreas da carreira */}
        <section aria-labelledby="minhas-areas" className="space-y-2">
          <h2 id="minhas-areas" className="text-sm font-semibold">Avise-me de concursos novos em</h2>
          <div className="flex flex-wrap gap-2">
            {(areas ?? []).map((a) => {
              const on = followedAreas.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleArea(a.id, a.name)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
                  )}
                >
                  {on ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  {a.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Filtros */}
        <section className="space-y-2" aria-label="Filtros">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por órgão, banca, cidade ou UF"
              className="pl-9"
              aria-label="Buscar concurso"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger aria-label="Área"><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {(areas ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={esfera} onValueChange={setEsfera}>
              <SelectTrigger aria-label="Abrangência"><SelectValue placeholder="Abrangência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Nacional, estadual e municipal</SelectItem>
                {(Object.keys(ESFERA_LABEL) as RadarEsfera[]).map((e) => <SelectItem key={e} value={e}>{ESFERA_LABEL[e]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-primary" />
              Só o que eu acompanho
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-primary" />
              Mostrar concursos já realizados
            </label>
          </div>
        </section>

        {/* Lista */}
        <section className="space-y-3" aria-live="polite">
          {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted/50 animate-pulse" />)}
          {isError && (
            <p className="text-center text-sm text-muted-foreground py-8">
              O radar está sendo preparado. Volte em instantes.
            </p>
          )}
          {!isLoading && !isError && list.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Nada por aqui com esses filtros.</p>
                <p>Acompanhe uma área acima: quando surgir concurso novo nela, você recebe o aviso.</p>
              </CardContent>
            </Card>
          )}
          {list.map((c) => <RadarConcursoCard key={c.id} concurso={c} />)}
        </section>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          Cada informação vem de uma fonte oficial e é conferida antes de aparecer aqui. Mesmo assim, confirme sempre
          no edital e no site da banca antes de se inscrever.
        </p>
      </div>
    </div>
  );
}
