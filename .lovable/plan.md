

## Diagnóstico Final

O código está correto — o helper `_evolution.ts` já testa os 3 formatos de autenticação (apikey, Bearer, ambos). Todos retornam 401, o que significa que **o valor da chave (`EVOLUTION_API_KEY`) não é aceito pelo servidor** `theo-ia-theo-evolution-api.wb2m7z.easypanel.host`.

## Ação Necessária

1. **Atualizar o secret `EVOLUTION_API_KEY`** com a chave correta do servidor `theo-ia-theo-evolution-api.wb2m7z.easypanel.host`
   - Acesse o painel do EasyPanel ou o dashboard da Evolution API nesse servidor
   - Copie a Global API Key correta
   - Atualize o secret no Supabase

2. **Redeployar as Edge Functions** que usam a Evolution API para garantir que peguem o novo valor

3. **Testar a criação de instância** na página /whatsapp

## Como encontrar a chave correta

- Acesse `https://theo-ia-theo-evolution-api.wb2m7z.easypanel.host/manager` no navegador
- Faça login no painel da Evolution API
- Vá em Settings/Configurações e copie a **Global API Key**
- Essa é a chave que deve ser configurada como `EVOLUTION_API_KEY`

## Detalhes Técnicos

- Nenhuma alteração de código é necessária
- O helper `_evolution.ts` já cobre os 3 formatos de auth
- O problema é exclusivamente o valor do secret

