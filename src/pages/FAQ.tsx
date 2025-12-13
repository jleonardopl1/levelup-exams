import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Send, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqItems = [
  {
    question: "Como nossas perguntas são formuladas?",
    answer: "Nossas perguntas são elaboradas por especialistas em concursos públicos, baseadas em provas anteriores e nos editais mais recentes. Cada questão passa por uma rigorosa revisão para garantir precisão e relevância, abrangendo todas as áreas exigidas nos principais certames do país."
  },
  {
    question: "Como gerar o PDF com as Explicações?",
    answer: "Após concluir um simulado, usuários Plus podem acessar a opção 'Exportar PDF' na tela de resultados. O documento inclui todas as questões, suas respostas corretas e explicações detalhadas geradas por nossa IA, perfeito para revisar offline."
  },
  {
    question: "Quais as vantagens do plano Plus?",
    answer: "O plano Plus oferece: questões ilimitadas por dia, acesso ao Mentor IA para tirar dúvidas, explicações detalhadas geradas por IA, estatísticas avançadas de desempenho, questões exclusivas e premium, exportação de PDFs com explicações, e experiência sem anúncios."
  },
  {
    question: "Quem somos nós?",
    answer: "Somos uma equipe apaixonada por educação e tecnologia, dedicada a ajudar concurseiros a alcançarem seus objetivos. Nossa missão é democratizar o acesso a materiais de estudo de qualidade, utilizando inteligência artificial para personalizar a experiência de aprendizado."
  },
  {
    question: "Como gerar o pagamento?",
    answer: "Para assinar o plano Plus, acesse a página 'Upgrade' no menu do aplicativo. Você pode escolher entre o plano mensal (R$ 19,90/mês) ou anual (R$ 159,90/ano). O pagamento é processado de forma segura através do Stripe, aceitando cartões de crédito e débito."
  },
  {
    question: "Como me tornar um Parceiro?",
    answer: "Interessado em parcerias? Entre em contato conosco através do email parcerias@simuladosconcursos.com.br. Trabalhamos com criadores de conteúdo, professores, cursinhos preparatórios e instituições educacionais para expandir nosso banco de questões e alcance."
  },
  {
    question: "Como funciona o sistema de níveis?",
    answer: "Seu nível evolui conforme você pratica! Começando como Iniciante, você progride para Intermediário, Avançado e Expert baseado no número de questões respondidas e sua taxa de acerto. Níveis mais altos desbloqueiam questões mais desafiadoras e conteúdo exclusivo."
  },
  {
    question: "O que é o Mentor IA?",
    answer: "O Mentor IA é seu tutor pessoal disponível 24/7. Usuários Plus podem fazer até 6 perguntas por dia para esclarecer dúvidas sobre qualquer tema abordado em nossos simulados. O Mentor explica conceitos, oferece dicas de estudo e ajuda a entender questões complexas."
  },
  {
    question: "Como funciona o limite diário de questões?",
    answer: "Usuários do plano gratuito podem responder até 30 questões por dia. Este limite é renovado à meia-noite. Para estudar sem limites, considere assinar o plano Plus e tenha acesso ilimitado a todo nosso conteúdo."
  },
  {
    question: "Como acompanhar meu progresso?",
    answer: "Na tela inicial você encontra suas estatísticas principais: número de simulados, taxa de precisão e sequência de dias estudando. Usuários Plus têm acesso a estatísticas avançadas com gráficos de evolução, análise por categoria e comparação de desempenho ao longo do tempo."
  }
];

export default function FAQ() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }

    if (formData.name.length > 100) {
      toast({
        title: "Nome muito longo",
        description: "O nome deve ter no máximo 100 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (formData.message.length > 2000) {
      toast({
        title: "Mensagem muito longa",
        description: "A mensagem deve ter no máximo 2000 caracteres.",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-contact', {
        body: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim()
        }
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada!",
        description: "Responderemos em breve. Verifique seu email.",
      });

      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      console.error('Error sending contact:', error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="glass" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold text-primary-foreground">
            Perguntas Frequentes
          </h1>
        </div>
        <p className="text-primary-foreground/80 text-sm">
          Encontre respostas para as dúvidas mais comuns
        </p>
      </div>

      {/* Content */}
      <div className="px-4 py-6 -mt-4 space-y-6">
        <Card variant="elevated">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5 text-primary" />
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card variant="elevated">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5 text-primary" />
              Ainda tem dúvidas?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">
              Envie sua pergunta e responderemos o mais breve possível.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  maxLength={100}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  maxLength={255}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  placeholder="Descreva sua dúvida..."
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  maxLength={2000}
                  rows={4}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.message.length}/2000
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full gap-2"
                disabled={isSubmitting}
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Enviando...' : 'Enviar mensagem'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
