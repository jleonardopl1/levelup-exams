import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '@/components/LegalLayout';
import { SITE } from '@/config/site';

const Mail = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export default function Privacy() {
  return (
    <LegalLayout title="Política de Privacidade">
      <p className="text-[15px] leading-relaxed text-muted-foreground mb-8">
        Esta Política explica, de forma direta, quais dados pessoais o <strong className="text-foreground">{SITE.name}</strong>{' '}
        coleta, por que coleta, com quem compartilha e como você exerce seus direitos, conforme a Lei Geral de
        Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <LegalSection id="controlador" title="1. Quem é o responsável pelos seus dados">
        <p>
          O controlador dos dados é <strong>{SITE.controller}</strong>, responsável pelo {SITE.name}, com sede em{' '}
          {SITE.city}. Para qualquer assunto de privacidade, inclusive como encarregado (DPO), o canal é: <Mail />.
        </p>
      </LegalSection>

      <LegalSection id="dados" title="2. Quais dados coletamos">
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e senha (guardada apenas de forma criptografada). Se você entrar com
            Google, Microsoft ou Apple, recebemos somente nome, e-mail e foto de perfil — nunca a sua senha dessas contas.
          </li>
          <li>
            <strong>Perfil de estudo:</strong> área ou concurso de interesse, data da prova (se informada) e preferências
            de lembrete.
          </li>
          <li>
            <strong>Uso da plataforma:</strong> respostas às questões, resultados de simulados, sequência de dias,
            conquistas, pontos, posição no ranking e uso do Mentor IA.
          </li>
          <li>
            <strong>Assinatura:</strong> plano contratado e situação do pagamento. Os dados do cartão são digitados e
            processados diretamente pelo Stripe; o {SITE.name} não recebe nem armazena o número do cartão.
          </li>
          <li>
            <strong>Programa de parceiros:</strong> código de indicação, visitas e conversões geradas pelo link e
            registros de repasses aos parceiros.
          </li>
          <li>
            <strong>Mensagens:</strong> o conteúdo que você envia pelo formulário de contato ou ao Mentor IA.
          </li>
          <li>
            <strong>Dados técnicos:</strong> registros de acesso e segurança (data, hora, endereço IP e navegador),
            que guardamos por no mínimo 6 meses, como exige o Marco Civil da Internet (Lei nº 12.965/2014).
          </li>
        </ul>
        <p>Não coletamos dados pessoais sensíveis nem pedimos CPF para usar a plataforma.</p>
      </LegalSection>

      <LegalSection id="finalidades" title="3. Para que usamos e com qual base legal">
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (criar a conta, montar simulados e trilhas, registrar seu progresso, liberar
            o plano Plus) — execução de contrato (art. 7º, V).
          </li>
          <li>
            <strong>Cobrar a assinatura e cumprir obrigações fiscais</strong> — execução de contrato e cumprimento de
            obrigação legal (art. 7º, II e V).
          </li>
          <li>
            <strong>Segurança e prevenção a fraudes</strong>, inclusive limites de uso e bloqueio de abusos — legítimo
            interesse (art. 7º, IX) e guarda legal de registros.
          </li>
          <li>
            <strong>Ranking e conquistas</strong>: seu nome de exibição e sua pontuação aparecem para outros alunos.
            Você pode alterar o nome de exibição a qualquer momento nas configurações.
          </li>
          <li>
            <strong>Lembretes e avisos</strong> sobre estudos e sua conta — você pode desligar os lembretes quando quiser.
          </li>
          <li>
            <strong>Melhorar o produto</strong> com estatísticas agregadas de uso — legítimo interesse.
          </li>
        </ul>
        <p>Não vendemos seus dados e não os usamos para publicidade de terceiros.</p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="4. Com quem compartilhamos">
        <p>Somente com fornecedores necessários para o serviço funcionar, que tratam os dados em nosso nome:</p>
        <ul>
          <li>
            <strong>Hospedagem, banco de dados e autenticação:</strong> Lovable e Supabase.
          </li>
          <li>
            <strong>Pagamentos:</strong> Stripe.
          </li>
          <li>
            <strong>Inteligência artificial do Mentor e das explicações:</strong> o texto da sua pergunta é enviado ao
            provedor de IA (Google Gemini, via Lovable AI) apenas para gerar a resposta. Não envie dados pessoais nas
            perguntas ao Mentor.
          </li>
          <li>
            <strong>Login social:</strong> Google, Microsoft e Apple, quando você escolhe entrar por eles.
          </li>
          <li>
            <strong>Autoridades</strong>, quando houver ordem judicial ou obrigação legal.
          </li>
        </ul>
        <p>
          Alguns desses fornecedores armazenam dados fora do Brasil. Nesses casos a transferência segue o art. 33 da LGPD,
          com cláusulas contratuais e padrões de segurança compatíveis com a lei brasileira.
        </p>
      </LegalSection>

      <LegalSection id="google" title="5. Dados recebidos do Google">
        <p>
          Ao usar “Entrar com Google”, recebemos apenas seu nome, e-mail e foto de perfil, usados exclusivamente para
          criar e identificar sua conta no {SITE.name}. Não acessamos Gmail, Drive, contatos ou qualquer outro dado da
          sua Conta do Google. O uso dessas informações segue a{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de uso limitado. Você pode remover o acesso a qualquer momento em{' '}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/connections
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="retencao" title="6. Por quanto tempo guardamos">
        <p>
          Enquanto sua conta estiver ativa. Ao excluir a conta, apagamos ou anonimizamos seus dados em até 30 dias,
          exceto o que a lei nos obriga a manter: registros de acesso (6 meses) e dados de cobrança e fiscais (até 5
          anos).
        </p>
      </LegalSection>

      <LegalSection id="direitos" title="7. Seus direitos">
        <p>Pela LGPD (art. 18), você pode, a qualquer momento e sem custo:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>pedir anonimização, bloqueio ou exclusão de dados desnecessários;</li>
          <li>pedir a portabilidade e uma cópia dos seus dados;</li>
          <li>excluir sua conta e revogar consentimentos;</li>
          <li>saber com quem compartilhamos seus dados.</li>
        </ul>
        <p>
          Envie o pedido para <Mail /> a partir do e-mail cadastrado. Respondemos em até 15 dias. Você também pode
          procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </LegalSection>

      <LegalSection id="seguranca" title="8. Segurança">
        <p>
          Usamos conexão criptografada (HTTPS), senhas com hash, controle de acesso por usuário no banco de dados e
          registros de auditoria em ações administrativas. Se ocorrer um incidente que traga risco relevante, avisaremos
          você e a ANPD, como determina a lei.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies e armazenamento local">
        <p>
          Usamos apenas o armazenamento do navegador necessário para manter você conectado, lembrar preferências e
          registrar a indicação de um parceiro. Não usamos cookies de publicidade.
        </p>
      </LegalSection>

      <LegalSection id="menores" title="10. Menores de idade">
        <p>
          O {SITE.name} é destinado a maiores de 18 anos. Adolescentes a partir de 16 anos podem usar com autorização
          dos pais ou responsáveis, que respondem pela contratação do plano Plus.
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="11. Alterações desta Política">
        <p>
          Podemos atualizar esta Política. Mudanças relevantes serão avisadas no aplicativo ou por e-mail antes de
          valerem. Leia também os <Link to="/termos">Termos de Uso</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
