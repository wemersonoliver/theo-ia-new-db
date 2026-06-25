## Objetivo
Adicionar avisos legais claros na página `/igreen` deixando explícito que **Theo IA não é parte da Igreen Energy**, é apenas uma ferramenta independente criada para atender licenciados/parceiros da marca. Isso reduz risco de uso indevido de marca.

## O que será alterado
Apenas o arquivo `src/pages/IgreenLanding.tsx` (frontend, sem mudanças de lógica/backend).

### 1. Banner de aviso no topo (logo abaixo do nav)
Faixa discreta, fundo âmbar/transparente, texto curto:
> "Aviso: Theo IA é uma empresa independente. Não somos afiliados, associados, autorizados, endossados ou de qualquer forma oficialmente conectados à Igreen Energy. Marcas e nomes citados pertencem aos seus respectivos donos."

### 2. Ajuste no Hero
Trocar o badge atual ("Versão exclusiva para parceiros Igreen Energy") por uma redação que não sugira parceria oficial:
> "Ferramenta independente feita para licenciados Igreen Energy"

### 3. Nova pergunta no FAQ
Adicionar como primeira pergunta:
- **P:** "Vocês são da Igreen Energy?"
- **R:** "Não. Theo IA é uma empresa independente de tecnologia. Não temos vínculo societário, comercial ou de representação com a Igreen Energy. Criamos uma versão do nosso sistema de atendimento por IA pensada para o dia a dia de quem já é licenciado/parceiro oficial da Igreen. Todas as marcas, logos e nomes citados pertencem aos seus respectivos titulares."

### 4. Disclaimer reforçado no Footer
Adicionar bloco de texto pequeno acima da linha de copyright:
> "Theo IA é um produto independente e não possui vínculo, parceria, patrocínio ou autorização da Igreen Energy Ltda. As referências à Igreen são feitas apenas para descrever o público-alvo da ferramenta (licenciados e parceiros oficiais da Igreen). Todas as marcas registradas pertencem aos seus respectivos titulares."

### 5. Ajustes pontuais de copy (para não soar como produto oficial)
- "Sistema personalizado para representantes Igreen Energy" → "Sistema independente, personalizado para o dia a dia de licenciados Igreen Energy"
- Mantém o resto do conteúdo de vendas intacto.

## O que NÃO será alterado
- Nenhuma Edge Function, banco, RLS ou lógica de negócio.
- Sem mudanças em rotas, checkout ou outras páginas.
- Sem mudança de design system / cores.

## Observação importante
Esses textos reduzem risco, mas **não substituem orientação jurídica**. Se quiser, depois posso adicionar uma página `/disclaimer` dedicada, ou ajustar a redação conforme texto que seu advogado validar.