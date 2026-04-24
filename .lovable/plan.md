
# Plano — Página de Investidores Data-Driven

Reescrever completamente `src/pages/Investors.tsx` para transformar a página em uma tese de investimento persuasiva, orientada a dados, com foco em **tamanho de mercado**, **gap de adoção de IA** e **matemática de penetração** que mostra ser preciso converter <0,2% do mercado endereçável para bater a meta.

## Estrutura nova (scroll vertical único)

### 1. Header sticky
- Logo "Theo IA" + navegação âncora: Mercado · Gap · Matemática · Solução · CRM · Projeção · Visão
- CTA "Quero investir"

### 2. Hero
- Título forte: "O atendimento de milhões de empresas brasileiras ainda é feito por humanos cansados."
- Subtítulo posicionando Theo IA como o atendente digital 24/7
- 3 `StatCounter` animados:
  - **21,4 milhões** de PMEs no Brasil
  - **78%** ainda não usam IA no atendimento
  - **R$ 1,1 mi** ARR projetado em 12 meses
- 2 CTAs: "Quero investir" / "Ver a oportunidade"

### 3. O Problema (com dados)
- 4 cards estatísticos:
  - 79% dos consumidores desistem após 1h sem resposta
  - 64% preferem WhatsApp como canal de atendimento
  - 90% das PMEs não atendem 24h
  - Tempo médio de 1ª resposta > 9 horas
- Frase âncora: "Cada hora sem resposta = um cliente perdido"

### 4. Tamanho do Mercado — TAM / SAM / SOM
- Componente `MarketFunnel` (3 círculos concêntricos):
  - **TAM**: 21,4M PMEs no Brasil
  - **SAM**: 6M PMEs com WhatsApp como canal principal de vendas
  - **SOM**: 600 mil PMEs prontas para adotar IA em 24 meses
- Texto curto explicando cada camada

### 5. O Gap de Adoção (a oportunidade)
- Componente `GapChart` (barras horizontais animadas):
  - Precisam de automação no atendimento: **86%**
  - Já usam alguma IA hoje: **22%**
  - **Gap = 64% do mercado descoberto**
- Frase: "64% das PMEs sabem que precisam — e ainda não têm solução"

### 6. A Matemática da Meta (sessão-chave)
- Componente `MathBreakdown` revelando linha a linha:
  ```
  SOM ........................ 600.000 empresas
  Precisamos converter ....... 0,167%
  = Meta 2026 ................ 1.000 clientes ativos
  × R$ 97/mês ................ R$ 97.000 MRR
  × 12 meses ................. R$ 1.164.000 ARR
  ```
- Destaque: "Menos de 2 a cada 1.000 empresas do nosso SOM"
- Frase: "Não é uma aposta. É aritmética."

### 7. A Solução — Theo IA
- Grid de 6 features com ícone:
  - Atendimento 24/7 no WhatsApp
  - Entende áudio e imagem
  - Qualifica e agenda automaticamente
  - Follow-up inteligente
  - Treinado por negócio
  - Substitui pré-venda + SDR + organização

### 8. CRM Integrado (diferencial)
- Mock visual do Kanban (4 colunas: Novo · Qualificado · Proposta · Ganho)
- 3 bullets: gestão em tempo real · histórico unificado · pipeline customizável

### 9. Público-Alvo
- Grid 8 nichos com ícone (autônomos, clínicas, advogados, restaurantes, academias, energia solar, prestadores, e-commerce)

### 10. Modelo de Negócio
- Card único: R$ 97/mês · SaaS · receita recorrente · alta retenção esperada

### 11. Projeção de Crescimento (roadmap)
- Componente `ProjectionTable` com colunas Período · Clientes · MRR · ARR:
  - Dez/2026 — 1.000 — R$ 97 mil — R$ 1,16 mi
  - Dez/2027 — 5.000 — R$ 485 mil — R$ 5,82 mi
  - Dez/2028 — 15.000 — R$ 1,45 mi — R$ 17,4 mi
- Frase: "Crescimento previsível, não especulativo"

### 12. Estratégia de Crescimento
- 5 pilares: tráfego pago validado · expansão por nicho · indicação · evolução do produto · upsell

### 13. Diferenciais Competitivos
- 5 cards comparando "Chatbots tradicionais" vs "Theo IA"

### 14. Visão de Futuro
- Texto curto: "Tornar o Theo IA o padrão de atendimento das PMEs brasileiras"

### 15. CTA Final
- "O momento de entrar é agora"
- Botão grande "Falar com fundadores"

### 16. Footer institucional
- Copyright + nota: "Projeções internas baseadas em dados públicos Sebrae/IBGE/Meta — não constituem garantia"

## Componentes internos novos (no mesmo arquivo)
- `StatCounter` — número animado com interpolação ao entrar no viewport
- `MarketFunnel` — 3 círculos concêntricos SVG/CSS com labels
- `GapChart` — barras horizontais animadas em viewport
- `MathBreakdown` — bloco estilo "cálculo no quadro" com linhas em cascata
- `ProjectionTable` — tabela estilizada com hover
- `Section` — wrapper `whileInView` fade-up (mantido)

## Design
- Paleta dark já em uso (slate/zinc + âmbar/violeta accents)
- Tipografia grande (text-5xl/6xl) nos títulos
- `framer-motion` viewport-triggered (já instalado — sem novas dependências)
- Estatísticas marcadas claramente como projeções no rodapé

## Arquivos
- **Editar**: `src/pages/Investors.tsx` (reescrita completa)
- **Sem alterações**: rotas, banco de dados, edge functions, dependências
