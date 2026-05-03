## Fix tela branca ao voltar de conversa no mobile

### Problema
No mobile (Android/iOS), ao abrir uma conversa e clicar em voltar, a tela fica branca. Causa: o Radix UI (Sheet/Dialog) deixa estilos residuais (`pointer-events: none`, `aria-hidden`, `overflow: hidden`) no `<body>` e `#root` quando há diálogos aninhados (DealDialog, AlertDialog, FinalizeDialog) sendo desmontados junto com o Sheet de conversa.

### Mudanças

**1. `src/pages/Conversations.tsx`**
- Refatorar `closeMobileChat` para:
  - Forçar fechamento de todos os diálogos filhos (DealDialog, AlertDialog de exclusão, FinalizeDialog) antes de fechar o Sheet.
  - Após 350ms (duração da animação de saída), limpar manualmente do `<body>` e `#root`: `pointer-events`, `overflow`, atributo `aria-hidden` e `data-scroll-locked`.
- Mover os componentes `DealDialog`, `AlertDialog` e `FinalizeDialog` para FORA do `<SheetContent>` (renderizá-los no nível raiz da página) — assim eles não são desmontados em cascata com o Sheet.

**2. `src/components/crm/DealDialog.tsx`**
- Não há ref direto, mas o warning "Function components cannot be given refs" aparece porque `DialogFooter` (em `src/components/ui/dialog.tsx`) não usa `forwardRef`. Converter `DialogFooter` e `DialogHeader` para `React.forwardRef` em `src/components/ui/dialog.tsx` para eliminar o warning que pode quebrar restauração de foco do Radix.

**3. Garantia adicional**
- Adicionar um `useEffect` de cleanup em `Conversations.tsx` que, ao desmontar a página, garante a limpeza dos estilos residuais.

### Arquivos afetados
- `src/pages/Conversations.tsx` (lógica de fechamento + reposicionamento de modais)
- `src/components/ui/dialog.tsx` (forwardRef em Header/Footer)

### Resultado esperado
Voltar da conversa no mobile fecha o Sheet limpamente, sem estilos residuais bloqueando interação ou ocultando a tela.