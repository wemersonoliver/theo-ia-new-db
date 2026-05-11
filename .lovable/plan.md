## PWA Simples — Theo IA

Implementar apenas manifest e meta tags (sem Service Worker). Isso torna o app instalável em Android, iOS e desktop sem risco de cache obsoleto.

### Passos

1. **Gerar ícones PWA**
   - Gerar ícone 192x192 (`public/icon-192.png`) e 512x512 (`public/icon-512.png`) com fundo transparente e versão maskable (`public/icon-maskable.png`).
   - Usar o logo/identidade do Theo IA (IA / WhatsApp / tom profissional).

2. **Criar manifest.webmanifest**
   - `name: "Theo IA"`, `short_name: "Theo IA"`
   - `display: "standalone"`, `orientation: "portrait"`
   - `theme_color: "#0F172A"`, `background_color: "#0F172A"`
   - `start_url: "/"`, `scope: "/"`
   - Ícones: 192, 512 e maskable.

3. **Atualizar index.html**
   - Adicionar `<link rel="manifest" href="/manifest.webmanifest" />`
   - Adicionar `<link rel="apple-touch-icon" href="/icon-192.png" />`
   - Adicionar meta tags Apple:
     - `apple-mobile-web-app-capable: yes`
     - `apple-mobile-web-app-status-bar-style: black-translucent`
     - `apple-mobile-web-app-title: Theo IA`
   - Manter todo o restante (OG, Pixel, Clarity, reCAPTCHA) intacto.

4. **Componente InstallPrompt (leve)**
   - Criar `src/components/pwa/InstallPrompt.tsx`.
   - Ouvir `beforeinstallprompt` e exibir botão flutuante/toast "Instalar Theo IA" (Android/Desktop).
   - Detectar iOS via user-agent e mostrar instruções "Compartilhar > Adicionar à Tela Inicial".
   - Adicionar o componente no `App.tsx` (condicional, não bloqueante).

### O que NÃO inclui (versão simples)
- Nenhum Service Worker / vite-plugin-pwa.
- Nenhum cache offline, update banner ou fallback offline.
- Sem risco de usuários presos em versão antiga.

### Resultado
- App instalável com ícone na home screen.
- Experiência standalone (sem barra de endereço).
- Splash screen automática no Android; iOS via meta tags.
