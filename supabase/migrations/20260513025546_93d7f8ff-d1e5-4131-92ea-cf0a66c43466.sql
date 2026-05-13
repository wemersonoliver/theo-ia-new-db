UPDATE public.whatsapp_ai_config
SET custom_prompt = regexp_replace(
      custom_prompt,
      'Rua 7 de Setembro, 601, Centro, Santo Ângelo/RS\. Entre a Rua 15 de Novembro e Av\. Getúlio Vargas, na diagonal com a Vanipar\.',
      'Rua 7 de Setembro, 601, Centro, Santo Ângelo/RS. Entre a Rua 15 de Novembro e Av. Getúlio Vargas, na diagonal com a Vanipar.' || E'\n' ||
      'Link do mapa (envie SEMPRE junto do endereço): https://maps.app.goo.gl/erjvVG3kD9aC8aug7'
    ),
    updated_at = now()
WHERE user_id = '744e33a8-3b85-4593-948e-bcaf81f8397b';