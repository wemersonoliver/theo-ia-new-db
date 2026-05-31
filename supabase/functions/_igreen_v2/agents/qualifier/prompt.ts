// Qualifier — textos determinísticos. Sem LLM (zero latência, zero custo).

// Saudação dinâmica por horário (America/Sao_Paulo).
function greetingPrefix(): string {
  const hourSP = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hourSP >= 5 && hourSP < 12) return "Bom dia";
  if (hourSP >= 12 && hourSP < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Primeira mensagem: cumprimenta e já pede o nome do cliente,
 * apresentando a Assistente Virtual da iGreen Energy.
 */
export function buildGreetOpenText(): string {
  return `${greetingPrefix()}! Aqui é a Assistente Virtual da iGreen Energy. Com quem eu tenho o prazer de falar?`;
}

/**
 * Após o cliente informar o nome, apresenta o menu de produtos
 * já personalizando com o primeiro nome.
 */
export function buildMenuText(clientName?: string | null): string {
  const nome = (clientName ?? "").trim();
  const intro = nome
    ? `Prazer em falar com você, ${nome}. Para eu te direcionar da melhor forma, me conta: você está buscando?`
    : `Perfeito 😊 Para eu te direcionar da melhor forma, me conta: você está buscando?`;
  return `${intro}

1 - Economia na conta de luz sem instalar nada

2 - Planos de telefonia e internet para seu telefone

3 - Como se tornar um Licenciado da iGreen e ganhar dinheiro vendendo assinaturas e placas solares

Qual dessas opções faz mais sentido para você?`;
}

export const MENU_SHORT_TEXT = `Pra te direcionar certinho, me diz qual faz mais sentido:

1 - Economia na conta de luz
2 - Telefonia e internet
3 - Ser licenciado iGreen

Você prefere qual?`;

export const ASK_NAME_TEXT = `Antes de continuar, com quem eu tenho o prazer de falar?`;

export const ASK_NAME_AFTER_PRODUCT_TEXT = `Que ótimo seu interesse 😊

Antes de te explicar tudo, com quem eu tenho o prazer de falar?`;

export function buildRouteGreenText(clientName?: string | null): string {
  const nome = (clientName ?? "").trim();
  const saud = nome ? `Que ótimo seu interesse na Conexão Green, ${nome}! 😊` : `Que ótimo seu interesse na Conexão Green! 😊`;
  return `${saud}

É a nossa solução de energia por assinatura, que te dá desconto na conta de luz todo mês, sem precisar de obra ou instalação.

Vou te enviar um vídeo rápido explicando como funciona. Me avisa quando assistir, tá? 😉`;
}

export const ROUTE_TELECOM_TEXT = `Massa! Vou te direcionar pro nosso time de telefonia e internet. Me conta rapidinho: você quer plano novo ou portabilidade?`;

export const ROUTE_EXPANSAO_TEXT = `Que legal seu interesse em ser licenciado iGreen 🚀 Posso te explicar como funciona o programa de licenciamento?`;

// Compatibilidade com imports antigos (não usar em código novo).
export const GREET_OPEN_TEXT = buildGreetOpenText();
export const MENU_TEXT = buildMenuText(null);
export const ROUTE_GREEN_TEXT = buildRouteGreenText(null);