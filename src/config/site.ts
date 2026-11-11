/**
 * Identidade pública do LevelUp Exams — fonte única para nome, domínio e contato.
 *
 * Usada nas páginas legais (Política de Privacidade e Termos de Uso), no rodapé e
 * na tela de login. O Google compara o nome exibido aqui com o nome configurado na
 * tela de consentimento OAuth durante a verificação da marca, por isso os dois
 * precisam ser idênticos: "LevelUp Exams".
 *
 * QUANDO O DOMÍNIO PRÓPRIO ESTIVER ATIVO: troque `domain` e `contactEmail` abaixo
 * (ou defina VITE_SITE_DOMAIN e VITE_CONTACT_EMAIL) e publique.
 */
export const SITE = {
  name: 'LevelUp Exams',
  /** Domínio público sem "https://". */
  domain: import.meta.env.VITE_SITE_DOMAIN ?? 'levelupexams.com.br',
  /** E-mail de suporte e de privacidade (canal do encarregado/LGPD). */
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL ?? 'contato@levelupexams.com.br',
  /** Controlador dos dados (pessoa física responsável pelo serviço). */
  controller: 'Jonas Leonardo de Paula Leite da Silva',
  city: 'Cuiabá/MT',
  /** Data da versão vigente dos documentos legais (dd/mm/aaaa). */
  legalUpdatedAt: '11/11/2026',
} as const;

export const siteUrl = (path = '/') => `https://${SITE.domain}${path}`;
