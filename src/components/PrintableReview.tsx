import { SITE } from '@/config/site';

export interface PrintableItem {
  enunciado: string;
  alternativas: string[];
  categoria: string;
  topico?: string | null;
  /** null = não respondida */
  selected: number | null;
  /** null = gabarito não disponível (questão não respondida no modo prática) */
  correctIndex: number | null;
  explicacao: string | null;
}

const letter = (i: number | null) => (i === null || i < 0 ? '—' : String.fromCharCode(65 + i));

/**
 * Versão para impressão / "Salvar como PDF" do resultado: só aparece no papel
 * (`hidden print:block`). A tela normal fica com `print:hidden`.
 */
export function PrintableReview({ title, summary, items }: {
  title: string;
  summary: string[];
  items: PrintableItem[];
}) {
  return (
    <div className="hidden print:block text-black bg-white text-[11pt] leading-snug">
      <header className="mb-4 border-b border-black/30 pb-2">
        <p className="text-[9pt] uppercase tracking-wider">{SITE.name}</p>
        <h1 className="text-[16pt] font-bold">{title}</h1>
        {summary.map((line) => <p key={line} className="text-[10pt]">{line}</p>)}
      </header>
      <ol className="space-y-4">
        {items.map((item, i) => {
          const status = item.selected === null ? 'Não respondida'
            : item.selected === item.correctIndex ? 'Acertou' : 'Errou';
          return (
            <li key={i} className="break-inside-avoid">
              <p className="text-[9pt]">
                Questão {i + 1} · {item.categoria}{item.topico ? ` · ${item.topico}` : ''} · <strong>{status}</strong>
              </p>
              <p className="font-medium my-1">{item.enunciado}</p>
              <ul className="ml-2">
                {item.alternativas.map((alt, j) => (
                  <li key={j} className={j === item.correctIndex ? 'font-bold' : ''}>
                    {letter(j)}) {alt}
                    {j === item.correctIndex ? '  ✓ gabarito' : ''}
                    {j === item.selected && j !== item.correctIndex ? '  ✗ sua resposta' : ''}
                  </li>
                ))}
              </ul>
              {item.explicacao && (
                <p className="mt-1 text-[10pt] border-l-2 border-black/40 pl-2">
                  <strong>Explicação: </strong>{item.explicacao}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-[8pt]">Gerado em {new Date().toLocaleString('pt-BR')} · {SITE.domain}</p>
    </div>
  );
}
