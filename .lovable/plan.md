## Diagnóstico — atendimento André (5588993713785)

### O que aconteceu na conversa
1. Cliente se apresentou como "André", recebeu o vídeo, perguntou sobre economia.
2. **Cliente informou valor (R$220-250) e estado (Ceará). A IA NÃO apresentou simulação de economia** — só disse vagamente *"a iGreen tem uma faixa oficial de economia"* e já pediu a fatura. Cliente reagiu: *"Essa faixa de economia / Isso significa o que???"*. A IA respondeu de novo sem números.
3. Cliente enviou fatura da Enel-CE em nome de **ANDRE DA SILVA BRASIL** (CPF 022.255.463-04) — ele é o titular.
4. A IA respondeu: *"vi que a fatura está em nome de outra pessoa"* — falso positivo.
5. Cliente esclareceu: *"Qual nome que tá aí???"* → IA chutou: *"Ah, a fatura está no nome do André, né?"*.
6. A IA pediu: *"prosseguir com o cadastro em nome de **BC ICMS**"* e depois *"RG ou CNH de **BC**"* — nome do titular virou lixo do OCR (cabeçalho "BC ICMS(R$)" capturado como nome).
7. Cliente mandou o RG correto (ANDRÉ DA SILVA BRASIL, mesmo CPF da fatura). A IA rejeitou: *"documento está em outro nome... preciso do RG ou CNH de BC"*.
8. Humano teve que assumir tudo manualmente. Handoff disparou com motivo errado.

### Causas raiz
- **(A) Simulação de economia não disparada**: o agente `green` recebe `valor_fatura` e `estado` mas nunca chama uma ferramenta de cálculo. Só verbaliza "tem faixa oficial" sem número concreto.
- **(B) Extração de `holder_name` rasa e frágil**: o validador atual procura por uma única âncora ("NOME DO CLIENTE") e pega a primeira string próxima. Quando a fatura tem layout diferente (Enel-CE, Equatorial, CPFL, Light, etc.) ele captura lixo: cabeçalho de coluna ("BC ICMS"), hash de código de barras, "TOTAL A PAGAR", etc.
- **(C) Sem análise de TODO o cabeçalho**: o validador olha 1-2 linhas em vez de varrer todo o bloco superior da fatura, onde o nome do titular sempre aparece com âncoras variadas por distribuidora.
- **(D) Sem reconciliação por CPF**: a fatura traz CPF mascarado (`022.***.***-4`), o RG traz CPF completo. O sistema nunca cruza esses dados — só compara strings de nome.
- **(E) Sem revalidação quando o RG chega**: o RG é validado isolado e o `holder_match_status: "mismatch"` da fatura permanece travado.
- **(F) IA "alucina" confirmações** ("Ah, está no nome do André, né?") e cita nomes-lixo extraídos ("BC ICMS") como se fossem verdade.

## Plano de correção

### 1. Apresentar simulação de economia ao receber estado + valor
- Em `_igreen_v2/agents/green/run.ts`, regra nova: assim que `extras.invoice_value` e `extras.state` (ou `distribuidora`) estiverem preenchidos, **antes** de pedir a fatura, chamar nova ferramenta `calculate_savings` que consulta `igreen_distributor_discounts` e devolve:
  - `percentual_desconto`
  - `economia_mensal_reais`
  - `economia_anual_reais`
- A IA envia mensagem com números concretos: *"André, no Ceará nosso desconto é de X% sobre a parte de energia. Na sua fatura de R$220 isso dá cerca de R$YY por mês — quase R$ZZ por ano! Pra confirmar e iniciar, me envia a foto/PDF da última fatura."*
- Se o estado não tiver desconto cadastrado, a IA admite isso abertamente e oferece falar com humano — nunca inventa número.

### 2. Reescrever extração do titular para suportar QUALQUER layout de fatura
Em `igreen-document-validator/index.ts`:

**2.1. Analisar o cabeçalho inteiro, não 1 linha**
- Definir "região do cabeçalho" como os primeiros ~40% do texto OCR (até antes do bloco de consumo/tributos).
- Coletar TODAS as linhas dessa região como candidatas a nome do titular.

**2.2. Conjunto amplo de âncoras por distribuidora**
Buscar em ordem de prioridade (case-insensitive, com acentos opcionais):
```text
NOME DO CLIENTE | NOME/RAZÃO SOCIAL | NOME E ENDEREÇO | CLIENTE:
TITULAR | DEVEDOR | CONSUMIDOR | UNIDADE CONSUMIDORA
RAZÃO SOCIAL | NOME COMPLETO | SR(A) | SENHOR(A) | DESTINATÁRIO
```
Para cada âncora encontrada, pegar a linha imediatamente seguinte (ou a mesma linha após `:`) como candidata.

**2.3. Fallback geométrico/posicional**
Se nenhuma âncora bater, varrer as primeiras 15 linhas e marcar como candidata toda linha que:
- Tem 2 a 5 palavras, todas alfabéticas (acentos ok).
- Está em CAIXA ALTA ou Title Case.
- Não contém termos de produto/imposto/distribuidora.

**2.4. Blocklist rígida (descartar candidatas inválidas)**
Rejeitar qualquer string que contenha:
```text
ICMS, PIS, COFINS, TUSD, TE, kWh, MWh, R$, CNPJ, CPF, INSCRIÇÃO,
BC, BASE, ALÍQUOTA, TOTAL, SUBTOTAL, BANDEIRA, TARIFA, VENCIMENTO,
ENEL, CPFL, EQUATORIAL, LIGHT, NEOENERGIA, COELBA, COSERN, ENERGISA,
ELEKTRO, EDP, COPEL, CEMIG, CEEE, CELESC, CELPE, RGE,
strings com >2 dígitos seguidos, hashes hex/base64, strings >40 chars sem espaço,
palavras únicas de 1-2 letras
```

**2.5. Ranking e escolha**
- Pontuar cada candidata sobrevivente: +3 se veio de âncora explícita, +2 se está em CAIXA ALTA com 2-4 palavras, +1 se aparece próxima ao CPF do titular.
- Escolher a de maior pontuação. Empate → a mais alta no documento.
- Se nenhuma candidata passa OU score < 3 → `holder_name: null` + `holder_confidence: "low"`.

### 3. Extrair e usar CPF da fatura como chave forte
- Capturar CPF (mascarado `022.***.***-4` ou completo) e gravar `extras.invoice_holder_cpf_mask` e `extras.invoice_holder_cpf_full` (quando disponível).
- Quando o RG chegar, comparar:
  - **Match forte por CPF**: CPF do RG bate (parcial via máscara ou total) com o da fatura → `holder_match: true`, ignora qualquer divergência de nome.
  - **Match por nome**: similaridade token-set ≥ 0.85.
- Emitir evento `holder_revalidated` que limpa `holder_match_status: "mismatch"` e `invoice_rejected_notified`.

### 4. Guards no prompt do agente `green` (`run.ts`)
- Se `extras.invoice_holder_name` for `null` OU `holder_confidence === 'low'`: **nunca** dizer "está em nome de outra pessoa". Em vez disso perguntar abertamente: *"A fatura está no seu nome ou no nome de outra pessoa? Se for de outra pessoa, qual o nome completo do titular?"*
- **Proibir** afirmar nomes (do titular ou do cliente) que não estejam confirmados no state. Guard textual: *"Nunca cite nomes de terceiros extraídos de documentos sem confirmação explícita do cliente. Nunca invente confirmações ('está no nome do X, né?')."*

### 5. Re-trigger automático ao receber RG
- Em `igreen-document-validator`, quando o tipo for `identity` e já existir fatura no state, rodar automaticamente a reconciliação (item 3) em vez de validar o RG isolado.
- Emitir evento `holder_match_resolved` e setar `etapa_funil: "cadastro_em_andamento"`.

### 6. Corrigir notificação de handoff
- Em `_igreen_v2/automations/handoff.ts`: branch novo `holder_mismatch_low_confidence` em `buildHandoffCopy` → "⚠️ IA precisa de ajuda para confirmar titular (baixa confiança na extração)" em vez de "cliente concluiu envio de documentos".

### Arquivos afetados
```text
supabase/functions/igreen-document-validator/index.ts          (reescrever extração + CPF + revalidação)
supabase/functions/_igreen_v2/agents/green/run.ts              (simulação + prompt guards)
supabase/functions/_igreen_v2/tools/calculate_savings.ts       (nova ferramenta)
supabase/functions/_igreen_v2/tools/validate_green_invoice.ts  (holder_confidence, cpf_mask, cpf_full)
supabase/functions/_igreen_v2/automations/handoff.ts           (chave low_confidence)
```

### Como validar
1. Reprocessar a fatura da Enel-CE do André → esperar `holder_name: "ANDRE DA SILVA BRASIL"` (ou `null`+low, nunca "BC ICMS"); `invoice_holder_cpf_mask: "022.***.***-4"`.
2. Testar com 3-4 layouts diferentes (Enel-CE, Equatorial, CPFL, Coelba) → titular correto em todas, ou `low_confidence` honesto.
3. Sequência fatura→RG com mesmo CPF → `holder_match: true` automático.
4. Conversa com estado=Ceará + valor=R$220 → IA responde com número concreto antes de pedir a fatura.
5. Logs do `whatsapp-igreen-agent-v2` → IA nunca cita nomes não confirmados.