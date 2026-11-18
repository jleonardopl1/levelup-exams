import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '@/components/LegalLayout';
import { SITE } from '@/config/site';

const Mail = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export default function Terms() {
  return (
    <LegalLayout title="Termos de Uso">
      <p className="text-[15px] leading-relaxed text-muted-foreground mb-8">
        Estes Termos regem o uso do <strong className="text-foreground">{SITE.name}</strong>, plataforma gamificada de
        estudos para concursos públicos oferecida por {SITE.controller} ({SITE.city}). Ao criar uma conta você declara
        que leu e concorda com estes Termos e com a <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
      </p>

      <LegalSection id="servico" title="1. O serviço">
        <p>
          O {SITE.name} oferece simulados, trilhas de estudo, ranking, conquistas e um Mentor com inteligência
          artificial. O acesso gratuito tem limite diário de questões; o plano <strong>Plus</strong> libera os recursos
          descritos na página de planos.
        </p>
        <p>
          O {SITE.name} é um material de apoio independente: <strong>não tem vínculo</strong> com bancas organizadoras,
          órgãos públicos ou editais, e não garante aprovação em concurso.
        </p>
      </LegalSection>

      <LegalSection id="conta" title="2. Sua conta">
        <ul>
          <li>Você precisa ter 18 anos ou mais, ou 16 anos com autorização dos responsáveis.</li>
          <li>As informações de cadastro devem ser verdadeiras, e a conta é pessoal e intransferível.</li>
          <li>Você é responsável por manter sua senha em sigilo e por tudo o que for feito na sua conta.</li>
        </ul>
      </LegalSection>

      <LegalSection id="plus" title="3. Plano Plus, pagamento e cancelamento">
        <ul>
          <li>
            O Plus é uma assinatura mensal ou anual com renovação automática, cobrada no cartão pelo Stripe, nos valores
            exibidos na página de planos no momento da contratação.
          </li>
          <li>
            <strong>Direito de arrependimento:</strong> você pode desistir em até 7 dias da primeira contratação e
            recebe o valor integral de volta (art. 49 do Código de Defesa do Consumidor).
          </li>
          <li>
            Você pode cancelar a renovação a qualquer momento. O acesso Plus continua até o fim do período já pago, sem
            novas cobranças.
          </li>
          <li>
            Mudanças de preço valem apenas para renovações futuras e serão avisadas com antecedência.
          </li>
        </ul>
        <p>
          Para cancelar, pedir reembolso ou tirar dúvidas sobre cobrança, escreva para <Mail />.
        </p>
      </LegalSection>

      <LegalSection id="conteudo" title="4. Conteúdo e propriedade intelectual">
        <p>
          Questões autorais, explicações, trilhas, marca, logotipo e o software do {SITE.name} são protegidos por lei.
          Você pode usá-los para seu estudo pessoal, mas não pode copiar, revender, redistribuir ou extrair o banco de
          questões de forma automatizada. Questões de provas anteriores são reproduzidas para fins de estudo, com
          indicação da fonte.
        </p>
      </LegalSection>

      <LegalSection id="ia" title="5. Mentor IA">
        <p>
          As respostas do Mentor e as explicações geradas por IA são automáticas e podem conter erros. Confira sempre o
          edital, a legislação vigente e a doutrina antes de tomar decisões. Não informe dados pessoais nas perguntas.
        </p>
      </LegalSection>

      <LegalSection id="conduta" title="6. Regras de uso">
        <p>Não é permitido:</p>
        <ul>
          <li>usar robôs, scripts ou várias contas para burlar limites, pontuar no ranking ou obter recompensas;</li>
          <li>usar nomes de exibição ofensivos ou que se passem por outra pessoa;</li>
          <li>tentar acessar dados de outros usuários ou explorar falhas de segurança;</li>
          <li>usar o serviço para qualquer finalidade ilegal.</li>
        </ul>
        <p>
          Em caso de violação, podemos remover pontos e recompensas obtidos de forma irregular e suspender ou encerrar a
          conta, informando o motivo.
        </p>
      </LegalSection>

      <LegalSection id="parceiros" title="7. Programa de parceiros">
        <p>
          Parceiros convidados recebem comissão por assinaturas confirmadas a partir do seu link, conforme as condições
          combinadas no convite. Indicações próprias, fraudulentas ou estornadas não geram comissão.
        </p>
      </LegalSection>

      <LegalSection id="disponibilidade" title="8. Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter a plataforma estável, mas podem ocorrer interrupções para manutenção ou por falhas de
          terceiros. Nada nestes Termos limita os direitos garantidos pelo Código de Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection id="encerramento" title="9. Encerramento da conta">
        <p>
          Você pode pedir a exclusão da sua conta a qualquer momento pelo e-mail <Mail />. O tratamento dos dados após o
          encerramento segue a <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
      </LegalSection>

      <LegalSection id="alteracoes" title="10. Alterações e foro">
        <p>
          Podemos atualizar estes Termos; mudanças relevantes serão avisadas antes de valerem. Estes Termos seguem as
          leis brasileiras, e fica eleito o foro do domicílio do consumidor.
        </p>
        <p>
          Dúvidas: <Mail />.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
