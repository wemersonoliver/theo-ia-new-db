import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logImageUsage, logTextUsage, extractGeminiTokens } from "../_shared/ai-usage.ts";
import { openAIVisionFallback, detectCreditError, markProviderOutOfCredits, isProviderOutOfCredits } from "../_shared/ai-fallback/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const {
      messageKey,
      instanceName,
      mediaType,
      userId,
      phone,
      mediaBase64: inlineBase64,
      mimeType: inlineMime,
    } = payload;

    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("Missing GOOGLE_GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Missing configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Processing OCR for:", { instanceName, mediaType, hasInlineMedia: !!inlineBase64 });

    let base64Media: string | null = null;
    let mimeType: string = inlineMime || getMimeType(mediaType);

    if (inlineBase64) {
      // Caller já baixou a mídia (fluxo WAHA ou similar). Usamos direto.
      base64Media = inlineBase64.includes(",") ? inlineBase64.split(",")[1] : inlineBase64;
    } else {
      // Fluxo Evolution API: baixa base64 diretamente da instância.
      const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
      const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
      if (!evolutionUrl || !evolutionKey) {
        console.error("Missing Evolution creds and no inline media supplied");
        return new Response(JSON.stringify({ error: "Missing configuration" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const mediaResponse = await fetch(
        `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey },
          body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
        }
      );
      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        console.error("Evolution media error:", errorText);
        return new Response(JSON.stringify({ error: "Failed to download media" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const mediaData = await mediaResponse.json();
      base64Media = mediaData.base64 || null;
      mimeType = mediaData.mimetype || mimeType;
    }

    if (!base64Media) {
      return new Response(JSON.stringify({ error: "No media data received" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Media downloaded, size:", base64Media.length, "mimeType:", mimeType);

    // 2. Send to Google Gemini Vision API for OCR/Analysis
    const ocrInstruction = mediaType === "document"
      ? `Extraia o texto do documento com o máximo de fidelidade possível.
Priorize e transcreva obrigatoriamente, se existirem: nome do titular/cliente, CPF/CNPJ, unidade consumidora, distribuidora, endereço, consumo em kWh, valor total/a pagar, mês de referência e vencimento.
Não resuma. Não diga apenas que é uma fatura. Se for uma fatura de energia, copie os campos e linhas relevantes mesmo que algumas partes estejam difíceis.`
      : `Analise esta imagem e extraia todo o texto visível (OCR).
Se houver texto, transcreva-o fielmente.
Se for um documento, extraia todas as informações relevantes.
Se for uma imagem sem texto (foto, meme, etc), descreva brevemente o conteúdo.
Responda de forma direta, sem formatação especial.`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Media,
              },
            },
            { text: ocrInstruction },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    let geminiResponse: Response | null = null;
    let geminiFailReason = "";
    if (!isProviderOutOfCredits("gemini")) {
      for (let attempt = 0; attempt < 3; attempt++) {
        geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiPayload),
          }
        );

        if (geminiResponse.status === 429) {
          const waitMs = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
          console.log(`OCR Gemini 429, retrying in ${Math.round(waitMs)}ms (attempt ${attempt + 1}/3)`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }
    } else {
      geminiFailReason = "gemini_circuit_open";
    }

    let geminiData: any = null;
    let extractedText = "";
    if (geminiResponse && geminiResponse.ok) {
      geminiData = await geminiResponse.json();
      extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      if (geminiResponse) {
        const errorText = await geminiResponse.text();
        console.error("Gemini Vision error:", geminiResponse.status, errorText);
        if (detectCreditError(geminiResponse.status, errorText)) {
          markProviderOutOfCredits("gemini");
          geminiFailReason = "gemini_credits_exhausted";
        } else {
          geminiFailReason = `gemini_http_${geminiResponse.status}`;
        }
      } else {
        geminiFailReason = geminiFailReason || "gemini_no_response";
      }
      console.warn(`[process-image-ocr] Trying OpenAI Vision fallback (${geminiFailReason})`);
      const fb = await openAIVisionFallback({
        systemPrompt: "Você é um OCR fiel. Retorne apenas o texto extraído.",
        userPrompt: ocrInstruction,
        imageBase64: base64Media,
        mime: mimeType,
        model: "gpt-4o",
        ctx: { reason: geminiFailReason, phone },
      });
      if (!fb) {
        return new Response(JSON.stringify({ error: "OCR processing failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      extractedText = fb.raw_text || "";
    }

    // Registra custo: 1 imagem analisada + tokens de saída
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (userId && supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey);
        await logImageUsage(sb, {
          userId,
          source: "process-image-ocr",
          images: 1,
          referenceId: phone || instanceName,
        });
        const t = geminiData ? extractGeminiTokens(geminiData) : { input: 0, output: 0 };
        if (t.input || t.output) {
          await logTextUsage(sb, {
            userId,
            source: "process-image-ocr",
            tokensInput: t.input,
            tokensOutput: t.output,
            referenceId: phone || instanceName,
          });
        }
      }
    } catch (e) {
      console.error("logImageUsage failed:", e);
    }

    if (!extractedText) {
      console.log("No text extracted from image");
      return new Response(JSON.stringify({ 
        success: true, 
        text: "[Imagem sem texto identificável]",
        hasText: false
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("OCR result:", extractedText.slice(0, 200));

    return new Response(JSON.stringify({ 
      success: true, 
      text: extractedText,
      hasText: true
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("OCR processing error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

function getMimeType(mediaType: string): string {
  switch (mediaType) {
    case "image":
      return "image/jpeg";
    case "document":
      return "application/pdf";
    case "sticker":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}
