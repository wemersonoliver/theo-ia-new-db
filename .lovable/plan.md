

## Plano: Conectar WhatsApp com Codigo de Pareamento

### Contexto
A Evolution API suporta conexao via **pairing code** atraves do endpoint `GET /instance/connect/{instance}?number={phone}`. Quando o parametro `number` e passado, a API retorna um `pairingCode` (codigo de 8 digitos) alem do QR code. O usuario digita esse codigo no WhatsApp do celular em vez de escanear o QR.

### O que sera feito

**1. Atualizar a Edge Function `create-whatsapp-instance`**
- Aceitar um parametro opcional `phoneNumber` no body da requisicao
- Quando `phoneNumber` for fornecido, passar como query param `?number={phone}` nas chamadas ao endpoint `/instance/connect/` da Evolution API
- Retornar o campo `pairingCode` na resposta junto com o QR code
- Salvar o `pairing_code` no banco (nova coluna na tabela `whatsapp_instances`)

**2. Migrar banco de dados**
- Adicionar coluna `pairing_code TEXT` na tabela `whatsapp_instances` (nullable)

**3. Atualizar o hook `useWhatsAppInstance`**
- Adicionar `pairing_code` ao tipo `WhatsAppInstance`
- Atualizar `createInstance` para aceitar parametro opcional `phoneNumber`

**4. Atualizar a pagina `WhatsApp.tsx`**
- Adicionar tabs/toggle na tela de conexao: "QR Code" e "Conectar com Codigo"
- Na aba "Conectar com Codigo":
  - Input para o usuario digitar seu numero de telefone (com codigo do pais)
  - Botao "Gerar Codigo"
  - Exibicao do codigo de 8 digitos em formato grande e legivel (estilo OTP)
  - Countdown de expiracao (~60s) com auto-refresh
- Manter a aba QR Code com o comportamento atual

**5. Atualizar a Edge Function `refresh-whatsapp-qrcode`**
- Tambem aceitar `phoneNumber` para regenerar o pairing code quando necessario

### Detalhes Tecnicos

- Endpoint Evolution API: `GET /instance/connect/{instanceName}?number=5511999999999`
- Resposta inclui: `{ pairingCode: "ABCD1234", base64: "...", code: "..." }`
- O pairing code expira rapido (~60s), entao o refresh automatico sera importante
- A coluna `pairing_code` sera limpa quando o status mudar para `connected`

### Arquivos alterados
- `supabase/migrations/` — nova migracao (coluna `pairing_code`)
- `supabase/functions/create-whatsapp-instance/index.ts`
- `supabase/functions/refresh-whatsapp-qrcode/index.ts`
- `src/hooks/useWhatsAppInstance.ts`
- `src/pages/WhatsApp.tsx`
- `src/integrations/supabase/types.ts` (auto-atualizado)

