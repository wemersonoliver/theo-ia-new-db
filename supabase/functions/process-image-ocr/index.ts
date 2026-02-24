import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageKey, instanceName, mediaType } = await req.json();
    
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

    if (!evolutionUrl || !evolutionKey || !geminiApiKey) {
      console.error("Missing configuration:", { 
        hasEvolutionUrl: !!evolutionUrl, 
        hasEvolutionKey: !!evolutionKey, 
        hasGeminiKey: !!geminiApiKey 
      });
      return new Response(JSON.stringify({ error: "Missing configuration" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Processing OCR for:", { instanceName, mediaType });

    // 1. Download media from Evolution API
    const mediaResponse = await fetch(
      `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          message: { key: messageKey },
          convertToMp4: false,
        }),
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
    const base64Media = mediaData.base64;
    const mimeType = mediaData.mimetype || getMimeType(mediaType);

    if (!base64Media) {
      return new Response(JSON.stringify({ error: "No media data received" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Media downloaded, size:", base64Media.length, "mimeType:", mimeType);

    // 2. Send to Google Gemini Vision API for OCR/Analysis
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
            {
              text: `Analise esta imagem e extraia todo o texto visível (OCR). 
Se houver texto, transcreva-o fielmente.
Se for um documento, extraia todas as informações relevantes.
Se for uma imagem sem texto (foto, meme, etc), descreva brevemente o conteúdo.
Responda de forma concisa e direta, sem formatação especial.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    };

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini Vision error:", errorText);
      
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
      
      return new Response(JSON.stringify({ error: "OCR processing failed" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const geminiData = await geminiResponse.json();
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
