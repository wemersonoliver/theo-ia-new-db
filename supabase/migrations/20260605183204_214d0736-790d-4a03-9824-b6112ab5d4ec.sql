UPDATE public.whatsapp_ai_config
SET custom_prompt = replace(
  custom_prompt,
  E'    "Excelente 👊\nSeu benefício ficou registrado:\n    🖼️ [midia]\n    👤 Nome: [NOME COMPLETO]\n    🎁 Benefício: Curso profissionalizante EAD\n    📌 Status: Lista prioritária para futuras vagas presenciais\n    Assim que houver novas oportunidades na sua região, a equipe poderá entrar em contato.\n    Como combinado, vamos honrar nosso compromisso disponibilizando seu acesso ao curso EAD 👊🎁"',
  E'    "Excelente 👊\nSeu benefício ficou registrado:\n    👤 Nome: [NOME COMPLETO]\n    🎁 Benefício: Curso profissionalizante EAD\n    📌 Status: Lista prioritária para futuras vagas presenciais\n    Assim que houver novas oportunidades na sua região, a equipe poderá entrar em contato."\n    Em seguida, chame OBRIGATORIAMENTE a tool `send_promotional_image` com caption: "Segue o passo a passo para acessar seu curso EAD 👊🎁". Não envie nenhuma outra mensagem depois da tool — o card enviado já contém o site, o cupom e o polo de ensino.'
)
WHERE user_id = 'c753d23b-7f23-4d56-a867-6639897b6767';