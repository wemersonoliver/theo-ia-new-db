
Diagnóstico confirmado

- O erro que está acontecendo agora é este:
  - frontend: `POST /functions/v1/create-whatsapp-instance` retorna `500`
  - corpo visto na rede: `{"error":"Erro ao criar instância WhatsApp"}`
  - log da Edge Function: `Evolution API create error: {"status":401,"error":"Unauthorized","response":{"message":"Unauthorized"}}`
- Em outras palavras: a Edge Function está sendo chamada corretamente, mas o servidor novo da Evolution está recusando a autenticação ao tentar criar a instância.

O que isso prova

- Não é erro de tela, React ou rota.
- Não é falha de login do usuário no Supabase, porque a função executa até o ponto de tentar criar a instância.
- Não é mais o mesmo problema de `/manager` que gerava rota inválida; agora o servidor está respondendo com `401 Unauthorized`, então a chamada chega nele.
- O problema atual está na integração com a Evolution API do servidor novo.

Causa mais provável

- O servidor novo não está aceitando o formato de autenticação que o projeto usa hoje.
- Hoje quase todas as funções enviam só o header:
  - `apikey: EVOLUTION_API_KEY`
- Se o novo servidor exigir:
  - `Authorization: Bearer ...`
  - ou os dois headers ao mesmo tempo
  - ou uma chave diferente/escopo diferente
  então todas as funções de WhatsApp passam a falhar.
- Isso explica por que está quebrando tanto no painel comum quanto no fluxo de suporte/sistema: ambos dependem da mesma URL/chave e do mesmo padrão de autenticação.

Evidências no código

- `supabase/functions/create-whatsapp-instance/index.ts`
  - chama `POST ${evolutionUrl}/instance/create`
  - usa apenas `apikey`
  - quando falha, devolve erro genérico para o frontend
- `supabase/functions/manage-system-whatsapp/index.ts`
  - já normaliza a URL melhor
  - mas também usa apenas `apikey`
- `supabase/functions/refresh-whatsapp-qrcode/index.ts`
- `supabase/functions/disconnect-whatsapp-instance/index.ts`
- `supabase/functions/send-whatsapp-message/index.ts`
- `supabase/functions/manage-appointment/index.ts`
- `supabase/functions/notify-new-user/index.ts`
  - todas seguem o mesmo padrão e podem falhar no novo servidor pelo mesmo motivo

Problema secundário que está atrapalhando o diagnóstico

- O frontend recebe um erro genérico porque as Edge Functions retornam `4xx/5xx`.
- Com isso, o `supabase.functions.invoke()` tende a mostrar só “non-2xx status code”, escondendo o detalhe real.
- Então hoje o usuário vê “erro ao criar instância”, mas o erro verdadeiro é o `401 Unauthorized` da Evolution.

Plano de correção

1. Padronizar a integração com a Evolution
- Criar um helper compartilhado para:
  - normalizar `EVOLUTION_API_URL`
  - montar headers de autenticação
  - testar fallback de auth:
    - só `apikey`
    - só `Authorization: Bearer`
    - ambos
  - fazer parse seguro da resposta
  - registrar diagnóstico útil

2. Corrigir primeiro os fluxos críticos de conexão
- Aplicar o helper em:
  - `create-whatsapp-instance`
  - `manage-system-whatsapp`
  - `refresh-whatsapp-qrcode`
  - `disconnect-whatsapp-instance`

3. Corrigir os demais fluxos que também dependem da Evolution
- Aplicar o mesmo padrão em:
  - `send-whatsapp-message`
  - `manage-appointment`
  - `notify-new-user`
  - demais funções que hoje usam só `apikey`
- Isso evita “corrigir criação” e continuar quebrado no envio de mensagens/notificações.

4. Melhorar o retorno de erro para o frontend
- Fazer as Edge Functions responderem com JSON estruturado, por exemplo:
  - `ok: false`
  - `error: "Evolution API unauthorized"`
  - `diagnostics: { endpoint, status, auth_mode }`
- Preferir retorno legível ao frontend para não esconder o erro real.

5. Ajustar os hooks do frontend
- `src/hooks/useWhatsAppInstance.ts`
- `src/hooks/useSystemWhatsApp.ts`
- Exibir a mensagem real retornada pela função, em vez de apenas “non-2xx”.

6. Validar ponta a ponta
- Testar:
  - criar instância em `/whatsapp`
  - reconectar no admin/sistema
  - atualizar QR
  - desconectar
  - envio de mensagem após conexão
- Objetivo: garantir que o novo servidor não quebre outros fluxos além da criação.

Conclusão prática

- O erro real atual é: `401 Unauthorized` da Evolution API no endpoint de criação de instância.
- A causa mais provável é incompatibilidade entre o novo servidor e o formato de autenticação usado hoje.
- A correção certa não é mexer só em uma função; é padronizar a autenticação e o diagnóstico em todas as funções que falam com a Evolution.

Detalhes técnicos

```text
Frontend (/whatsapp)
  -> create-whatsapp-instance
  -> fetch EVOLUTION_API_URL + EVOLUTION_API_KEY
  -> POST /instance/create
  -> Evolution responde 401 Unauthorized
  -> Edge Function converte para 500 genérico
  -> frontend mostra erro genérico
```

Arquivos principais envolvidos:
- `src/hooks/useWhatsAppInstance.ts`
- `src/hooks/useSystemWhatsApp.ts`
- `supabase/functions/create-whatsapp-instance/index.ts`
- `supabase/functions/manage-system-whatsapp/index.ts`
- `supabase/functions/refresh-whatsapp-qrcode/index.ts`
- `supabase/functions/disconnect-whatsapp-instance/index.ts`

Quando você aprovar, eu sigo implementando essa correção de forma centralizada para o WhatsApp comum e o WhatsApp do sistema.
