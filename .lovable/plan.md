

## Implementação do Login com Google

### Alterações

**1. `src/lib/auth.tsx`** — Adicionar `signInWithGoogle` ao contexto:
```typescript
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard' }
  });
  return { error };
};
```

**2. `src/pages/Login.tsx`** — Adicionar botão "Entrar com Google" com separador visual ("ou") entre o botão principal e o botão Google.

**3. `src/pages/Register.tsx`** — Adicionar botão "Cadastrar com Google" com mesmo padrão visual.

### Visual dos botões
- Variante `outline`, largura total
- Ícone SVG do Google colorido à esquerda
- Separador com texto "ou" entre os botões existentes e o novo

### Pré-requisito (manual)
Antes de funcionar, você precisa configurar o Google Provider no Supabase Dashboard (Authentication → Providers → Google) com o Client ID e Secret do Google Cloud Console.

